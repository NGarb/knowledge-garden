import { useState } from 'react'

const CATEGORIES = ['Insight', 'Discovery', 'Pattern', 'Connection', 'Idea', 'Question']

export default function Garden({ entries }) {
  const [filter, setFilter] = useState(null)

  const filtered = filter ? entries.filter(e => e.category === filter) : entries

  return (
    <div className="garden">
      <div className="garden-filters">
        <button className={!filter ? 'fil active' : 'fil'} onClick={() => setFilter(null)}>all</button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={filter === c ? 'fil active' : 'fil'}
            onClick={() => setFilter(c)}
          >
            {c.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="garden-entries">
        {filtered.length === 0 && <p className="empty">nothing here yet.</p>}
        {filtered.map(e => (
          <div key={e.id} className="garden-entry">
            <div className="entry-meta">
              <span className="entry-type">{e.type}</span>
              <span className="entry-category">{e.category}</span>
              <span className="entry-date">{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
            <p className="entry-content">{e.content}</p>
            <div className="entry-tags">
              {(e.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
