import { useState, useRef } from 'react'
import { supabase } from '../supabase'

const CATEGORY_COLORS = {
  Insight:    '#4a7c59',
  Discovery:  '#5b6fa8',
  Pattern:    '#8b6914',
  Connection: '#7a4a8b',
  Idea:       '#b5451b',
  Question:   '#2a6a6a'
}

export default function Capture({ openQuestions, onSaved }) {
  const [type, setType] = useState('fact')
  const [content, setContent] = useState('')
  const [stage, setStage] = useState('writing') // writing | classifying | classified | saving | saved
  const [classification, setClassification] = useState(null)
  const [relatedEntries, setRelatedEntries] = useState([])
  const [connectedQuestions, setConnectedQuestions] = useState([])
  const [questionsToClose, setQuestionsToClose] = useState(new Set())
  const [newQuestion, setNewQuestion] = useState('')
  const [error, setError] = useState(null)
  const questionRef = useRef(null)

  async function handleAnalyse() {
    if (!content.trim()) return
    setStage('classifying')
    setError(null)

    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error('Classification failed')

      setClassification(data)

      const [{ data: related }, { data: matched }] = await Promise.all([
        supabase.rpc('match_entries', {
          query_embedding: data.embedding,
          match_threshold: 0.75,
          match_count: 4
        }),
        supabase.rpc('match_questions', {
          query_embedding: data.embedding,
          match_threshold: 0.72,
          match_count: 5
        })
      ])

      setRelatedEntries(related || [])
      setConnectedQuestions(matched || [])
      setStage('classified')
      setTimeout(() => questionRef.current?.focus(), 100)
    } catch (e) {
      setError(e.message)
      setStage('writing')
    }
  }

  async function handleSave() {
    if (!newQuestion.trim()) return
    setStage('saving')

    try {
      const embedRes = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newQuestion.trim() })
      })
      const { embedding: questionEmbedding } = await embedRes.json()

      const entryId = crypto.randomUUID()

      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .insert({
          id: entryId,
          type,
          content: content.trim(),
          category: classification.category,
          tags: classification.tags,
          embedding: classification.embedding
        })
        .select()
        .single()

      if (entryError) throw entryError

      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert({
          entry_id: entryId,
          text: newQuestion.trim(),
          embedding: questionEmbedding
        })
        .select()
        .single()

      if (qError) throw qError

      if (questionsToClose.size > 0) {
        await supabase
          .from('questions')
          .update({ closed_at: new Date().toISOString(), closed_by_entry_id: entryId })
          .in('id', [...questionsToClose])
      }

      onSaved(entry, question, questionsToClose)
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
    setClassification(null)
    setRelatedEntries([])
    setConnectedQuestions([])
    setQuestionsToClose(new Set())
    setNewQuestion('')
    setError(null)
  }

  function handleBack() {
    setStage('writing')
    setClassification(null)
    setRelatedEntries([])
    setConnectedQuestions([])
    setQuestionsToClose(new Set())
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

          <div className="question-section">
            <p className="question-label">your question</p>
            <textarea
              ref={questionRef}
              className="question-input"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="save-row">
            <button className="back-btn" onClick={handleBack}>← edit</button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={!newQuestion.trim() || stage === 'saving'}
            >
              {stage === 'saving' ? 'saving…' : 'save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
