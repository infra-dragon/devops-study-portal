import { useEffect, useState } from 'react'

export const NOT_FOUND = 'NOT_FOUND'

// Cache key: full path string (§8.3). Persists for the session; reset on page reload (ADR-005).
const cache = new Map()

async function loadManifest(path) {
  let response
  try {
    response = await fetch(path)
  } catch {
    throw new Error('Network error — could not reach the server.')
  }

  if (response.status === 404) {
    throw new Error(NOT_FOUND)
  }

  const contentType = response.headers.get('content-type') || ''
  if (response.ok && contentType.includes('text/html')) {
    // SPA fallback returned index.html in place of the missing manifest (§14.2, ADR-013).
    throw new Error(NOT_FOUND)
  }

  if (!response.ok) {
    throw new Error(`Unexpected error (HTTP ${response.status}).`)
  }

  let parsed
  try {
    parsed = JSON.parse(await response.text())
  } catch {
    throw new Error('Malformed manifest — could not parse JSON.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Malformed manifest — expected a JSON array.')
  }

  return [...parsed].sort((a, b) => a.order - b.order)
}

function getEntry(path) {
  let entry = cache.get(path)
  if (entry) return entry

  entry = { status: 'pending', value: null }
  entry.promise = loadManifest(path)
    .then((value) => {
      entry.status = 'resolved'
      entry.value = value
      return value
    })
    .catch((err) => {
      // Failures are not cached — the path is re-fetched on next mount or retry (§8.3).
      cache.delete(path)
      throw err
    })
  cache.set(path, entry)
  return entry
}

function initialState(path) {
  if (!path) return { data: null, loading: false, error: null }
  const entry = cache.get(path)
  if (entry && entry.status === 'resolved') {
    return { data: entry.value, loading: false, error: null }
  }
  return { data: null, loading: true, error: null }
}

export function useManifest(path) {
  const [state, setState] = useState(() => initialState(path))

  useEffect(() => {
    // No path yet (e.g. a dependent fetch still waiting on a parent manifest) — stay idle, don't fetch.
    if (!path) {
      setState({ data: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState(initialState(path))

    const entry = getEntry(path)
    entry.promise
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return state
}
