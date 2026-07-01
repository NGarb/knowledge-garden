import { useState } from 'react'

const CATEGORIES = ['Insight', 'Discovery', 'Pattern', 'Connection', 'Idea', 'Question']

function LeafEntry({ leaf, date }) {
  const [expanded, setExpanded] = useState(false)
  const citation = [leaf.authors, leaf.year, leaf.venue].filter(Boolean).join(' · ')

  return (
    <div className="leaf-entry">
      <div className="leaf-entry-header" onClick={() => setExpanded(e => !e)}>
        <div className="leaf-entry-top">
          <span className="entry-type">leaf</span>
          {citation && <span className="leaf-entry-citation">{citation}</span>}
          <span className="entry-date">{date}</span>
          <span className="leaf-expand-toggle">{expanded ? '−' : '+'}</span>
        </div>
        <p className="leaf-entry-claim">{leaf.claim}</p>
        {leaf.tags?.length > 0 && (
          <div className="entry-tags">
            {leaf.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
      </div>

      {expanded && (
        <div className="leaf-entry-body">
          {leaf.central_concepts?.length > 0 && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Central Concepts</span>
              <ul className="leaf-entry-list">
                {leaf.central_concepts.map((c, i) => (
                  <li key={i}><strong>{c.term}</strong> — {c.definition}</li>
                ))}
              </ul>
            </div>
          )}

          {leaf.method && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Method</span>
              <p>{leaf.method}</p>
            </div>
          )}

          {leaf.findings?.length > 0 && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Findings</span>
              <ul className="leaf-entry-list">
                {leaf.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {leaf.benchmarks?.length > 0 && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Benchmarks</span>
              <div className="leaf-benchmarks">
                {leaf.benchmarks.map((b, i) => (
                  <div key={i} className="leaf-benchmark-row">
                    <span className="leaf-benchmark-dataset">{b.dataset}</span>
                    <span className="leaf-benchmark-metric">{b.metric}</span>
                    <span className="leaf-benchmark-score">{b.score}</span>
                    {b.baseline && (
                      <span className="leaf-benchmark-baseline">vs {b.baseline_score} ({b.baseline})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {leaf.limitations?.length > 0 && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Limitations</span>
              <ul className="leaf-entry-list">
                {leaf.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}

          {leaf.implications && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Implications</span>
              <p>{leaf.implications}</p>
            </div>
          )}

          {leaf.practical_application && (
            <div className="leaf-entry-section leaf-entry-section--practical">
              <span className="leaf-entry-section-label">Practical Application</span>
              <p>{leaf.practical_application}</p>
            </div>
          )}

          {leaf.open_questions?.length > 0 && (
            <div className="leaf-entry-section">
              <span className="leaf-entry-section-label">Open Questions</span>
              <ul className="leaf-entry-list">
                {leaf.open_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Garden({ entries, openQuestions, onEntryUpdated }) {
  const [filter, setFilter] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const entriesWithOpenQ = new Set((openQuestions || []).map(q => q.entry_id))

  function getGroundState(entry) {
    if (entry.type !== 'seed' && entry.type !== 'fact') return null
    return entriesWithOpenQ.has(entry.id) ? 'semi' : 'settled'
  }

  const filtered = filter ? entries.filter(e => e.category === filter) : entries

  function startEdit(entry) {
    setEditingId(entry.id)
    setEditContent(entry.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditContent('')
  }

  async function saveEdit(entry) {
    if (!editContent.trim() || editContent.trim() === entry.content) {
      cancelEdit()
      return
    }
    setSaving(true)
    const embedRes = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editContent.trim() })
    })
    const { embedding } = await embedRes.json()

    const updateRes = await fetch('/api/entry-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, content: editContent.trim(), embedding })
    })
    const updated = await updateRes.json()

    if (updated) onEntryUpdated(updated)
    setSaving(false)
    setEditingId(null)
    setEditContent('')
  }

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
        {filtered.map(e => {
          if (e.type === 'leaf') {
            let leafData
            try { leafData = JSON.parse(e.content) } catch { leafData = null }
            if (leafData) {
              return (
                <LeafEntry
                  key={e.id}
                  leaf={leafData}
                  date={new Date(e.created_at).toLocaleDateString()}
                />
              )
            }
          }

          const gs = getGroundState(e)
          return (
            <div key={e.id} className={`garden-entry${editingId === e.id ? ' editing' : ''}${gs ? ` garden-entry--${gs}` : ''}`}>
              <div className="entry-meta">
                <span className="entry-type">{e.type}</span>
                <span className="entry-category">{e.category}</span>
                {gs === 'settled' && <span className="entry-grounded">grounded</span>}
                <span className="entry-date">{new Date(e.created_at).toLocaleDateString()}</span>
                {editingId !== e.id && (
                  <button className="edit-btn" onClick={() => startEdit(e)}>edit</button>
                )}
              </div>

              {editingId === e.id ? (
                <>
                  <textarea
                    className="entry-edit-input"
                    value={editContent}
                    onChange={ev => setEditContent(ev.target.value)}
                    rows={4}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button className="cancel-edit-btn" onClick={cancelEdit}>cancel</button>
                    <button
                      className="save-edit-btn"
                      onClick={() => saveEdit(e)}
                      disabled={saving || !editContent.trim()}
                    >
                      {saving ? 'saving…' : 'save'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="entry-content">{e.content}</p>
              )}

              <div className="entry-tags">
                {(e.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
