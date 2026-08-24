import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { useManifest } from './hooks/useManifest'
import Sidebar from './components/Sidebar.jsx'

const base = import.meta.env.BASE_URL

export default function App() {
  const { topicId, sectionId, pageId } = useParams()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: topics, loading: rootLoading, error: rootError } = useManifest(`${base}content/manifest.json`)
  const activeTopic = topics?.find((t) => t.id === topicId)

  const topicManifestPath = activeTopic?.type === 'topic' ? `${base}content/${topicId}/manifest.json` : null
  const { data: sections } = useManifest(topicManifestPath)
  const activeSection = sections?.find((s) => s.id === sectionId)

  const sectionManifestPath =
    activeSection?.type === 'section' ? `${base}content/${topicId}/${sectionId}/manifest.json` : null
  const { data: pages } = useManifest(sectionManifestPath)
  const activePage = pages?.find((p) => p.id === pageId)

  // Layout variants (§7.1): sidebar shows only for topic type:"topic".
  const showSidebar = activeTopic?.type === 'topic'

  // Close the off-canvas sidebar automatically on navigation (§7.1, §9).
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Document title (§7.1): "{Page title} · {Topic title} · DevOps Portal" — each segment
  // omitted while its manifest is still loading. Titles come only from manifests (ADR-009).
  useEffect(() => {
    let pageTitle = null
    let topicTitle = null

    if (activeTopic?.type === 'page') {
      pageTitle = activeTopic.title
    } else if (activeTopic?.type === 'topic') {
      topicTitle = activeTopic.title
      if (activeSection?.type === 'page') {
        pageTitle = activeSection.title
      } else if (activeSection?.type === 'section') {
        pageTitle = activePage?.title ?? null
      }
    }

    document.title = [pageTitle, topicTitle, 'DevOps Portal'].filter(Boolean).join(' · ')
  }, [activeTopic, activeSection, activePage])

  return (
    <div className="app-shell">
      <header className="top-nav">
        {showSidebar && (
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={sidebarOpen}
            aria-label="Toggle section navigation"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        )}
        <Link to="/" className="top-nav-home">
          DevOps Portal
        </Link>
        {activeTopic && <span className="top-nav-topic">{activeTopic.title}</span>}
      </header>

      <div className="app-body">
        {showSidebar && (
          <div className={sidebarOpen ? 'sidebar-container open' : 'sidebar-container'}>
            <Sidebar />
          </div>
        )}
        <main className="content-area">
          <Outlet context={{ topics, loading: rootLoading, error: rootError }} />
        </main>
      </div>
    </div>
  )
}
