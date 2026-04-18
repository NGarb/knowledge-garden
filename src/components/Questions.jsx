import { useState } from 'react'
import { supabase } from '../supabase'

export default function Questions({ questions, entries, onClose }) {
  const [closing, setClosing] = useState(null)

  async function handleClose(id) {
    setClosing(id)
    await supabase
      .from('questions')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', id)
    onClose(id)
    setClosing(null)
  }

  function getEntrySnippet(entryId) {
    const e = entries.find(e => e.id === entryId)
    if (!e) return ''
    return e.content.length > 90 ? e.content.slice(0, 90) + '…' : e.content
  }

  return (
    <div className="questions-view">
      <h2 className="questions-heading">questions i'm carrying</h2>
      {questions.length === 0 && <p className="empty">no open questions.</p>}
      <div className="questions-list">
        {questions.map(q => (
          <div key={q.id} className="question-item">
            <p className="question-text">{q.text}</p>
            <p className="question-origin">{getEntrySnippet(q.entry_id)}</p>
            <div className="question-actions">
              <span className="question-date">{new Date(q.created_at).toLocaleDateString()}</span>
              <button
                className="close-btn"
                onClick={() => handleClose(q.id)}
                disabled={closing === q.id}
              >
                {closing === q.id ? 'closing…' : 'close'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
