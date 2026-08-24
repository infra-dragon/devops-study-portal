import { Routes, Route, Navigate, useOutletContext, useParams } from 'react-router-dom'
import { useManifest } from './hooks/useManifest'
import App from './App.jsx'
import TopicGrid from './components/TopicGrid.jsx'
import ContentPanel from './components/ContentPanel.jsx'
import NotFound from './components/NotFound.jsx'

// Base path rule (§6): every fetch path and the router itself derive from BASE_URL —
// "/" by default, "/repo-name/" on subpath deploys (§14.4). Never hardcode "/content/...".
const base = import.meta.env.BASE_URL

function Loading() {
  return <p className="state-message">Loading…</p>
}

function ManifestError({ error }) {
  return <p className="state-message state-message--error">Failed to load: {error}</p>
}

// Route: "/" — Home (topic card grid). Not part of the §6 resolution algorithm
// (no redirects/invariants at this depth). TopicGrid receives its topic list from
// App via Outlet context (§7.2) rather than fetching its own.
function Home() {
  const { topics, loading, error } = useOutletContext()

  if (loading) return <Loading />
  if (error) return <ManifestError error={error} />

  return <TopicGrid topics={topics} />
}

// Route: "/:topicId" (§6 Resolution Algorithm)
// 1. Unknown topicId in root manifest → NotFound.
// 2. type:"page" → render its Markdown directly.
// 3. type:"topic" → redirect to the lowest-order entry: a page section redirects one level
//    deep; a section-type entry loads its own manifest and redirects two levels deep.
function TopicRoute() {
  const { topicId } = useParams()
  const { data: topics, loading: rootLoading, error: rootError } = useManifest(`${base}content/manifest.json`)

  const topic = topics?.find((t) => t.id === topicId)

  const topicManifestPath = topic?.type === 'topic' ? `${base}content/${topicId}/manifest.json` : null
  const { data: sections, loading: sectionsLoading, error: sectionsError } = useManifest(topicManifestPath)

  const firstSection = sections?.[0]
  const sectionManifestPath =
    firstSection?.type === 'section' ? `${base}content/${topicId}/${firstSection.id}/manifest.json` : null
  const { data: pages, loading: pagesLoading, error: pagesError } = useManifest(sectionManifestPath)

  if (rootLoading) return <Loading />
  if (rootError) return <ManifestError error={rootError} />
  if (!topic) return <NotFound />

  if (topic.type === 'page') {
    return <ContentPanel />
  }

  // topic.type === "topic" — auto-redirect to the first content page.
  if (sectionsLoading) return <Loading />
  if (sectionsError) return <ManifestError error={sectionsError} />
  if (!sections || sections.length === 0) return <NotFound />

  if (firstSection.type === 'page') {
    return <Navigate replace to={`/${topicId}/${firstSection.id}`} />
  }

  // firstSection.type === "section" — go one level deeper for the redirect target.
  if (pagesLoading) return <Loading />
  if (pagesError) return <ManifestError error={pagesError} />
  if (!pages || pages.length === 0) return <NotFound />

  return <Navigate replace to={`/${topicId}/${firstSection.id}/${pages[0].id}`} />
}

// Route: "/:topicId/:sectionId" (§6 Resolution Algorithm)
// 1. Topic must exist and be type:"topic" — a type:"page" topic has no valid two-segment URLs.
// 2. Unknown sectionId in the topic manifest → NotFound.
// 3. type:"page" → render its Markdown directly.
// 4. type:"section" → section-landing redirect to the lowest-order sub-page.
function SectionRoute() {
  const { topicId, sectionId } = useParams()
  const { data: topics, loading: rootLoading, error: rootError } = useManifest(`${base}content/manifest.json`)

  const topic = topics?.find((t) => t.id === topicId)
  const topicManifestPath = topic?.type === 'topic' ? `${base}content/${topicId}/manifest.json` : null
  const { data: sections, loading: sectionsLoading, error: sectionsError } = useManifest(topicManifestPath)

  const section = sections?.find((s) => s.id === sectionId)
  const sectionManifestPath =
    section?.type === 'section' ? `${base}content/${topicId}/${sectionId}/manifest.json` : null
  const { data: pages, loading: pagesLoading, error: pagesError } = useManifest(sectionManifestPath)

  if (rootLoading) return <Loading />
  if (rootError) return <ManifestError error={rootError} />
  // Depth invariant: topic must exist and be type "topic".
  if (!topic || topic.type !== 'topic') return <NotFound />

  if (sectionsLoading) return <Loading />
  if (sectionsError) return <ManifestError error={sectionsError} />
  if (!section) return <NotFound />

  if (section.type === 'page') {
    return <ContentPanel />
  }

  // section.type === "section" — section-landing redirect to the first sub-page.
  if (pagesLoading) return <Loading />
  if (pagesError) return <ManifestError error={pagesError} />
  if (!pages || pages.length === 0) return <NotFound />

  return <Navigate replace to={`/${topicId}/${sectionId}/${pages[0].id}`} />
}

// Route: "/:topicId/:sectionId/:pageId" (§6 Resolution Algorithm)
// 1. Topic must be type:"topic" and section must be listed as type:"section" → else NotFound.
// 2. Render the Markdown directly. pageId is deliberately NOT checked against the section
//    manifest — an unknown pageId is caught by the content fetch itself (§8.4).
function PageRoute() {
  const { topicId, sectionId } = useParams()
  const { data: topics, loading: rootLoading, error: rootError } = useManifest(`${base}content/manifest.json`)

  const topic = topics?.find((t) => t.id === topicId)
  const topicManifestPath = topic?.type === 'topic' ? `${base}content/${topicId}/manifest.json` : null
  const { data: sections, loading: sectionsLoading, error: sectionsError } = useManifest(topicManifestPath)

  const section = sections?.find((s) => s.id === sectionId)

  if (rootLoading) return <Loading />
  if (rootError) return <ManifestError error={rootError} />
  if (!topic || topic.type !== 'topic') return <NotFound />

  if (sectionsLoading) return <Loading />
  if (sectionsError) return <ManifestError error={sectionsError} />
  // Depth invariant: section must exist and be type "section".
  if (!section || section.type !== 'section') return <NotFound />

  return <ContentPanel />
}

// All route definitions in one place (§3).
export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Home />} />
        <Route path=":topicId" element={<TopicRoute />} />
        <Route path=":topicId/:sectionId" element={<SectionRoute />} />
        <Route path=":topicId/:sectionId/:pageId" element={<PageRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
