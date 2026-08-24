import { Link } from 'react-router-dom'

// Receives the topic list from App (root manifest data, already sorted by order) — §7.2.
export default function TopicGrid({ topics }) {
  return (
    <div className="topic-grid">
      {topics?.map((topic) => (
        <Link
          key={topic.id}
          to={`/${topic.id}`}
          className="topic-card"
          style={{ '--card-accent': topic.color }}
        >
          <span className="topic-card-icon" aria-hidden="true">
            {topic.icon}
          </span>
          <span className="topic-card-title">{topic.title}</span>
        </Link>
      ))}
    </div>
  )
}
