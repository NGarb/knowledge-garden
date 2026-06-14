import { useState, useRef, useEffect } from 'react'

const CATEGORY_COLORS = {
  Insight:    '#4a7c59',
  Discovery:  '#5b6fa8',
  Pattern:    '#8b6914',
  Connection: '#7a4a8b',
  Idea:       '#b5451b',
  Question:   '#2a6a6a'
}

export default function Capture({ openQuestions, onSaved, respondingTo, seedContent, onSeedConsumed }) {
  const [type, setType] = useState('fact')
  const [content, setContent] = useState('')
  const [stage, setStage] = useState('writing') // writing | classifying | classified | saving | saved
  const [stepLabel, setStepLabel] = useState('classifying…')
  const [classification, setClassification] = useState(null)
  const [relatedEntries, setRelatedEntries] = useState([])
  const [connectedQuestions, setConnectedQuestions] = useState([])
  const [questionsToClose, setQuestionsToClose] = useState(new Set())
  const [newQuestion, setNewQuestion] = useState('')
  const [contradictions, setContradictions] = useState([])
  const [gap, setGap] = useState(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState([])
  const [error, setError] = useState(null)
  const questionRef = useRef(null)

  useEffect(() => {
    if (seedContent) {
      setContent(seedContent)
      setStage('writing')
      setClassification(null)
      setRelatedEntries([])
      setConnectedQuestions([])
      setQuestionsToClose(new Set())
      setContradictions([])
      setGap(null)
      setSuggestedQuestions([])
      setError(null)
    }
  }, [seedContent])

  async function handleAnalyse() {
    if (!content.trim()) return
    setStage('classifying')
    setStepLabel('classifying…')
    setError(null)

    try {
      const res = await fetch('/api/agent-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() })
      })
      if (!res.ok) throw new Error('Analysis failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6).trim()
          if (!json) continue
          let event
          try { event = JSON.parse(json) } catch { continue }

          if (event.type === 'step') {
            setStepLabel(event.label)
          } else if (event.type === 'result') {
            const d = event.data
            setClassification({ category: d.category, tags: d.tags, embedding: d.embedding })
            setRelatedEntries(d.relatedEntries)
            setConnectedQuestions(d.connectedQuestions)
            setContradictions(d.contradictions)
            setGap(d.gap)
            setSuggestedQuestions(d.suggestedQuestions)
            setQuestionsToClose(new Set(d.connectedQuestions.map(q => q.id)))
            setStage('classified')
            setTimeout(() => questionRef.current?.focus(), 100)
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }
      }
    } catch (e) {
      setError(e.message)
      setStage('writing')
    }
  }

  async function handleSave() {
    if (type === 'thought' && !newQuestion.trim()) return
    setStage('saving')

    try {
      let questionEmbedding = null
      if (newQuestion.trim()) {
        const embedRes = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newQuestion.trim() })
        })
        const { embedding } = await embedRes.json()
        questionEmbedding = embedding
      }

      const entryId = crypto.randomUUID()

      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entryId,
          type,
          content: content.trim(),
          category: classification.category,
          tags: classification.tags,
          embedding: classification.embedding
        })
      })
      if (!entryRes.ok) throw new Error('Failed to save entry')
      const entry = await entryRes.json()

      let question = null
      if (newQuestion.trim()) {
        const qRes = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_id: entryId,
            text: newQuestion.trim(),
            embedding: questionEmbedding
          })
        })
        if (!qRes.ok) throw new Error('Failed to save question')
        question = await qRes.json()
      }

      const closedIds = new Set(questionsToClose)
      if (respondingTo) closedIds.add(respondingTo.id)

      if (closedIds.size > 0) {
        await fetch('/api/questions-close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [...closedIds], closed_by_entry_id: entryId })
        })
      }

      onSaved(entry, question, closedIds)
      setStage('saved')
    } catch (e) {
      setError(e.message)
      setStage('classified')
    }
  }

  function handleReset() {
    setType('fact')
    setContent('')
    setStage('writing')
    setStepLabel('classifying…')
    setClassification(null)
    setRelatedEntries([])
    setConnectedQuestions([])
    setQuestionsToClose(new Set())
    setNewQuestion('')
    setContradictions([])
    setGap(null)
    setSuggestedQuestions([])
    setError(null)
  }

  function handleBack() {
    setStage('writing')
    setClassification(null)
    setRelatedEntries([])
    setConnectedQuestions([])
    setQuestionsToClose(new Set())
    setContradictions([])
    setGap(null)
    setSuggestedQuestions([])
  }

  function toggleClose(id) {
    setQuestionsToClose(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (stage === 'saved') {
    return (
      <div className="capture saved-state">
        <p className="saved-msg">saved.</p>
        <button className="capture-another" onClick={handleReset}>capture another</button>
      </div>
    )
  }

  return (
    <div className="capture">
      {respondingTo && (
        <div className="responding-to">
          <span className="responding-label">responding to</span>
          <p className="responding-question">{respondingTo.text}</p>
        </div>
      )}
      <div className="type-toggle">
        <button className={type === 'fact' ? 'tog active' : 'tog'} onClick={() => setType('fact')}>fact</button>
        <button className={type === 'thought' ? 'tog active' : 'tog'} onClick={() => setType('thought')}>thought</button>
      </div>

      {stage === 'writing' || stage === 'classifying' ? (
        <>
          <textarea
            className="content-input"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder=""
            rows={6}
            disabled={stage === 'classifying'}
            autoFocus
          />
          {stage === 'classifying' && <p className="step-status">{stepLabel}</p>}
          {error && <p className="error">{error}</p>}
          <button
            className="analyse-btn"
            onClick={handleAnalyse}
            disabled={!content.trim() || stage === 'classifying'}
          >
            {stage === 'classifying' ? 'thinking…' : 'analyse →'}
          </button>
        </>
      ) : (
        <>
          <div className="content-display">{content}</div>

          <div className="classification">
            <span
              className="category-badge"
              style={{ '--cat-color': CATEGORY_COLORS[classification.category] || '#555' }}
            >
              {classification.category}
            </span>
            <div className="tags">
              {classification.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>

          {gap && <p className="gap-statement">{gap}</p>}

          {relatedEntries.length > 0 && (
            <div className="related-section">
              <h3>connects to</h3>
              {relatedEntries.map(e => (
                <div key={e.id} className="related-entry">
                  <span className="related-type">{e.type}</span>
                  <p>{e.content}</p>
                </div>
              ))}
            </div>
          )}

          {contradictions.length > 0 && (
            <div className="contradictions-section">
              <h3>may contradict</h3>
              {contradictions.map((c, i) => (
                <div key={i} className="contradiction-entry">
                  <p>{c}</p>
                </div>
              ))}
            </div>
          )}

          {connectedQuestions.length > 0 && (
            <div className="connected-questions-section">
              <h3>speaks to</h3>
              {connectedQuestions.map(q => (
                <div key={q.id} className={`connected-q${questionsToClose.has(q.id) ? ' marked-close' : ''}`}>
                  <p>{q.text}</p>
                  <button className="close-q-btn" onClick={() => toggleClose(q.id)}>
                    {questionsToClose.has(q.id) ? '↩ keep open' : 'close this'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {suggestedQuestions.length > 0 && (
            <div className="suggested-section">
              <h3>carry forward?</h3>
              {suggestedQuestions.map((q, i) => (
                <button key={i} className="suggested-q-btn" onClick={() => setNewQuestion(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="question-section">
            <p className="question-label">
              {type === 'fact' ? 'open a question (optional)' : 'your question'}
            </p>
            <textarea
              ref={questionRef}
              className="question-input"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder={type === 'fact' ? 'leave empty to save as settled ground' : ''}
              rows={3}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="save-row">
            <button className="back-btn" onClick={handleBack}>← edit</button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={(type === 'thought' && !newQuestion.trim()) || stage === 'saving'}
            >
              {stage === 'saving' ? 'saving…' : (newQuestion.trim() ? 'save + carry' : 'save')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
