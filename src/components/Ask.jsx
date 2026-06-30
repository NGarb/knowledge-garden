import { useState } from 'react'

export default function Ask({ garden }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), garden })
      })
      const data = await res.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ask">
      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          className="ask-input"
          type="text"
          placeholder="ask your garden anything…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button className="ask-submit" type="submit" disabled={loading || !question.trim()}>
          {loading ? 'thinking…' : 'ask →'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="ask-result">
          <p className="ask-answer">{result.answer}</p>

          {result.sources.length > 0 && (
            <div className="ask-sources">
              <p className="ask-sources-label">from your garden</p>
              {result.sources.map((s, i) => (
                <div key={s.id} className="ask-source-card">
                  <span className="ask-source-num">[{i + 1}]</span>
                  <div className="ask-source-body">
                    <p className="ask-source-content">{s.content}</p>
                    <div className="ask-source-meta">
                      <span className="ask-source-category">{s.category}</span>
                      {s.tags?.length > 0 && (
                        <span className="ask-source-tags">{s.tags.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
