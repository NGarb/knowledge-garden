import { useState } from 'react'

const CATEGORIES = ['Insight', 'Discovery', 'Pattern', 'Connection', 'Idea', 'Question']

export default function Garden({ entries, openQuestions, onEntryUpdated }) {
  const [filter, setFilter] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const entriesWithOpenQ = new Set((openQuestions || []).map(q => q.entry_id))

  function getGroundState(entry) {
    if (entry.type !== 'fact') return null
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
