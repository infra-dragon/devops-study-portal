import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import { useManifest } from '../hooks/useManifest'
import { useContent, NOT_FOUND } from '../hooks/useContent'
import NotFound from './NotFound.jsx'

const base = import.meta.env.BASE_URL

// Grammar registration mechanism (§2.3) — the one sanctioned place to extend the
// highlight.js common set. No content currently needs a language outside it.
export const highlightOptions = {
  languages: {},
}

// See the scroll-rules effect below for why this lives at module scope rather than a ref.
let lastScrolledPathname = null

// Asset resolution (ADR-010): relative image paths are rewritten against the page's
// content folder, since the browser would otherwise resolve them against the page URL.
function resolveAsset(src, folder) {
  if (/^https?:\/\//.test(src)) return src
  if (src.startsWith('/')) return src
  return `${base}content/${folder}/${src.replace(/^\.\//, '')}`
}

function buildMarkdownComponents(folder, navigate) {
  return {
    img({ src, alt }) {
      return <img src={resolveAsset(src, folder)} alt={alt} />
    },
    a({ href, children }) {
      // In-page anchor: smooth-scroll handled by the scroll effect below, keyed on hash.
      if (href?.startsWith('#')) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault()
              navigate(href)
            }}
          >
            {children}
          </a>
        )
      }

      // Root-relative app URL: client-side navigation, no page reload.
      if (href?.startsWith('/')) {
        return <Link to={href}>{children}</Link>
      }

      // External site.
      if (/^https?:\/\//.test(href || '')) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        )
      }

      // Anything else (relative) — authoring error (§11.4): render untouched.
      return <a href={href}>{children}</a>
    },
  }
}

// Derives the fetch path, the co-located asset folder, and which manifest holds this
// entry's title, purely from URL depth (§6). The depth invariants themselves were
// already checked upstream by the route resolver — this only runs once "render" applies.
function deriveEntry(topicId, sectionId, pageId) {
  if (pageId) {
    const folder = `${topicId}/${sectionId}/${pageId}`
    return {
      folder,
      mdPath: `${base}content/${folder}/${pageId}.md`,
      titleManifestPath: `${base}content/${topicId}/${sectionId}/manifest.json`,
      titleId: pageId,
    }
  }
  if (sectionId) {
    const folder = `${topicId}/${sectionId}`
    return {
      folder,
      mdPath: `${base}content/${folder}/${sectionId}.md`,
      titleManifestPath: `${base}content/${topicId}/manifest.json`,
      titleId: sectionId,
    }
  }
  const folder = `${topicId}`
  return {
    folder,
    mdPath: `${base}content/${folder}/${topicId}.md`,
    titleManifestPath: `${base}content/manifest.json`,
    titleId: topicId,
  }
}

export default function ContentPanel() {
  const { topicId, sectionId, pageId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [retryToken, setRetryToken] = useState(0)

  const { folder, mdPath, titleManifestPath, titleId } = deriveEntry(topicId, sectionId, pageId)

  const { data: titleEntries } = useManifest(titleManifestPath)
  const title = titleEntries?.find((entry) => entry.id === titleId)?.title ?? titleId

  // Cache key is the full path string (§8.3) — appending a retry token forces a fresh fetch.
  const fetchPath = retryToken > 0 ? `${mdPath}?retry=${retryToken}` : mdPath
  const { data: markdown, loading, error } = useContent(fetchPath)

  const contentReady = !loading && !error && markdown != null
  const components = useMemo(() => buildMarkdownComponents(folder, navigate), [folder, navigate])

  // Scroll rules (§9), one effect keyed on pathname, hash, and content readiness:
  // 1. Reset to top (instant) whenever the pathname actually changes.
  // 2/3. Once content has rendered, smooth-scroll to the hash's rehype-slug target —
  //      covers both a direct load with a hash and an in-page anchor click (same pathname).
  //
  // "Last scrolled pathname" is tracked at module scope, not a ref, because ContentPanel
  // remounts as a fresh instance when navigation crosses route patterns (e.g. a section
  // type:"page" route to a sub-page route) — a ref would reset to the new pathname on that
  // first render and rule 1 would silently never fire for exactly those transitions.
  useEffect(() => {
    const pathnameChanged = lastScrolledPathname !== location.pathname
    lastScrolledPathname = location.pathname

    if (pathnameChanged) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    if (location.hash && contentReady) {
      const id = location.hash.slice(1)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.pathname, location.hash, contentReady])

  if (loading) {
    return (
      <div className="content-loading" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    )
  }

  if (error === NOT_FOUND) {
    return <NotFound />
  }

  if (error) {
    return (
      <div className="content-error">
        <p>Something went wrong loading this page.</p>
        <button type="button" onClick={() => setRetryToken((t) => t + 1)}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <article className="content-panel">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFrontmatter]}
        rehypePlugins={[rehypeSlug, [rehypeHighlight, highlightOptions]]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
