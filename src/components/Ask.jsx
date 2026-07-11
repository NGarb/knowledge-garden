import { useState, useRef, useEffect } from 'react'

export default function Ask({ garden, onCaptureDelta }) {
  const [mode, setMode] = useState('ask') // 'ask' | 'learn'

  // ask mode state
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // learn mode state
  const [messages, setMessages] = useState([]) // { role, content }
  const [input, setInput] = useState('')
  const [learnLoading, setLearnLoading] = useState(false)
  const [learnError, setLearnError] = useState(null)
  const [gardenContext, setGardenContext] = useState(null)
  const [contextFetched, setContextFetched] = useState(false)
  const [delta, setDelta] = useState('')
  const [showDelta, setShowDelta] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, learnLoading])

  function switchMode(m) {
    setMode(m)
    setResult(null)
    setError(null)
    setQuestion('')
  }

  // --- ask mode ---
  async function handleAsk(e) {
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

  // --- learn mode ---
  async function handleLearn(e) {
    e.preventDefault()
    if (!input.trim() || learnLoading) return

    const userMessage = { role: 'user', content: input.trim() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLearnLoading(true)
    setLearnError(null)

    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          garden,
          context_fetched: contextFetched,
          garden_context: gardenContext
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (!contextFetched) {
        setGardenContext(data.garden_context)
        setContextFetched(true)
      }
    } catch (e) {
      setLearnError(e.message)
    } finally {
      setLearnLoading(false)
    }
  }

  function handleReset() {
    setMessages([])
    setInput('')
    setGardenContext(null)
    setContextFetched(false)
    setDelta('')
    setShowDelta(false)
    setLearnError(null)
  }

  function handleCaptureDelta() {
    if (onCaptureDelta && delta.trim()) {
      onCaptureDelta(`what shifted: ${delta.trim()}`)
    }
  }

  return (
    <div className="ask">
      <div className="ask-mode-toggle">
        <button
          className={mode === 'ask' ? 'ask-mode-btn active' : 'ask-mode-btn'}
          onClick={() => switchMode('ask')}
        >
          ask
        </button>
        <button
          className={mode === 'learn' ? 'ask-mode-btn active' : 'ask-mode-btn'}
          onClick={() => switchMode('learn')}
        >
          learn
        </button>
      </div>

      {mode === 'ask' && (
        <>
          <form className="ask-form" onSubmit={handleAsk}>
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
        </>
      )}

      {mode === 'learn' && (
        <div className="learn">
          {messages.length === 0 && !showDelta && (
            <p className="learn-prompt">
              start with: <em>"i'm trying to understand [X]. here's my current thinking:"</em>
            </p>
          )}

          {messages.length > 0 && (
            <div className="learn-thread">
              {messages.map((m, i) => (
                <div key={i} className={`learn-bubble learn-bubble--${m.role}`}>
                  <p>{m.content}</p>
                </div>
              ))}
              {learnLoading && (
                <div className="learn-bubble learn-bubble--assistant learn-bubble--thinking">
                  <p>thinking…</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {learnError && <p className="error">{learnError}</p>}

          {!showDelta && (
            <form className="learn-form" onSubmit={handleLearn}>
              <textarea
                className="learn-input"
                placeholder={messages.length === 0 ? "i'm trying to understand…" : "keep going…"}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLearn(e) }
                }}
                disabled={learnLoading}
                rows={3}
                autoFocus
              />
              <div className="learn-actions">
                {messages.length >= 2 && (
                  <button
                    type="button"
                    className="learn-end-btn"
                    onClick={() => setShowDelta(true)}
                  >
                    end session →
                  </button>
                )}
                <button className="ask-submit" type="submit" disabled={learnLoading || !input.trim()}>
                  {learnLoading ? '…' : '→'}
                </button>
              </div>
            </form>
          )}

          {showDelta && (
            <div className="learn-delta">
              <p className="learn-delta-label">what shifted?</p>
              <textarea
                className="learn-input"
                placeholder="one thing that changed in how you understand this…"
                value={delta}
                onChange={e => setDelta(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="learn-actions">
                <button type="button" className="learn-end-btn" onClick={handleReset}>
                  new session
                </button>
                <button
                  type="button"
                  className="ask-submit"
                  disabled={!delta.trim()}
                  onClick={handleCaptureDelta}
                >
                  capture →
                </button>
              </div>
            </div>
          )}

          {messages.length > 0 && !showDelta && (
            <button type="button" className="learn-reset-btn" onClick={handleReset}>
              reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
