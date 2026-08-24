import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useManifest } from '../hooks/useManifest'

const base = import.meta.env.BASE_URL

// Rendered only for topic type:"topic" (App decides visibility). Never shows the topic
// title — the top nav already communicates that context (ADR-007).
export default function Sidebar() {
  const { topicId, sectionId, pageId } = useParams()
  const { data: sections, loading, error } = useManifest(`${base}content/${topicId}/manifest.json`)

  const [expanded, setExpanded] = useState(() => new Set(sectionId ? [sectionId] : []))

  // Auto-expand the section containing the active page, on mount and whenever params change (§9).
  useEffect(() => {
    if (!sectionId) return
    setExpanded((prev) => (prev.has(sectionId) ? prev : new Set(prev).add(sectionId)))
  }, [sectionId])

  if (loading) return <p className="state-message">Loading…</p>
  if (error) return <p className="state-message state-message--error">Failed to load sidebar: {error}</p>

  return (
    <nav className="sidebar" aria-label="Section navigation">
      <ul>
        {sections?.map((section) => (
          <SidebarEntry
            key={section.id}
            topicId={topicId}
            section={section}
            isExpanded={expanded.has(section.id)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(section.id)) next.delete(section.id)
                else next.add(section.id)
                return next
              })
            }
            activeSectionId={sectionId}
            activePageId={pageId}
          />
        ))}
      </ul>
    </nav>
  )
}

function SidebarEntry({ topicId, section, isExpanded, onToggle, activeSectionId, activePageId }) {
  // A section is active if its id matches sectionId (§9). For a type:"page" entry this
  // is also the whole active-state check, since there's no pageId in its URL.
  const isActiveSection = section.id === activeSectionId

  if (section.type === 'page') {
    return (
      <li>
        <Link to={`/${topicId}/${section.id}`} className={isActiveSection ? 'sidebar-link active' : 'sidebar-link'}>
          {section.title}
        </Link>
      </li>
    )
  }

  // type: "section" — expandable group; its own manifest loads lazily on first expand.
  return (
    <li>
      <button
        type="button"
        className={isActiveSection ? 'sidebar-section-header active' : 'sidebar-section-header'}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span>{section.title}</span>
        <span className="sidebar-caret" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>
      {isExpanded && (
        <SidebarSubpages
          topicId={topicId}
          sectionId={section.id}
          // A sub-page is active only if its parent section is the active section (§9).
          activePageId={isActiveSection ? activePageId : null}
        />
      )}
    </li>
  )
}

function SidebarSubpages({ topicId, sectionId, activePageId }) {
  const { data: pages, loading, error } = useManifest(`${base}content/${topicId}/${sectionId}/manifest.json`)

  if (loading) return <p className="state-message">Loading…</p>
  if (error) return <p className="state-message state-message--error">Failed to load: {error}</p>

  return (
    <ul className="sidebar-subpages">
      {pages?.map((page) => (
        <li key={page.id}>
          <Link
            to={`/${topicId}/${sectionId}/${page.id}`}
            className={page.id === activePageId ? 'sidebar-link active' : 'sidebar-link'}
          >
            {page.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
