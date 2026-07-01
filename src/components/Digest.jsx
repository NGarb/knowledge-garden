import { useState } from 'react'

const CATEGORY_COLORS = {
  Insight:    '#4a7c59',
  Discovery:  '#5b6fa8',
  Pattern:    '#8b6914',
  Connection: '#7a4a8b',
  Idea:       '#b5451b',
  Question:   '#2a6a6a'
}

const LEAF_SECTION_LABELS = {
  claim:                'Claim',
  central_concepts:     'Central Concepts',
  method:               'Method',
  findings:             'Findings',
  benchmarks:           'Benchmarks',
  limitations:          'Limitations',
  implications:         'Implications',
  practical_application:'Practical Application',
  open_questions:       'Open Questions',
}

function LeafReview({ leaf, onLeafChange }) {
  const citation = [leaf.authors, leaf.year, leaf.venue].filter(Boolean).join(' · ')

  function updatePractical(val) {
    onLeafChange({ ...leaf, practical_application: val })
  }

  return (
    <div className="leaf-review">
      {citation && <p className="leaf-citation">{citation}</p>}

      <div className="leaf-section">
        <span className="leaf-section-label">Claim</span>
        <p className="leaf-section-body">{leaf.claim}</p>
      </div>

      {leaf.central_concepts?.length > 0 && (
        <div className="leaf-section">
          <span className="leaf-section-label">Central Concepts</span>
          <ul className="leaf-list">
            {leaf.central_concepts.map((c, i) => (
              <li key={i}><strong>{c.term}</strong> — {c.definition}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="leaf-section">
        <span className="leaf-section-label">Method</span>
        <p className="leaf-section-body">{leaf.method}</p>
      </div>

      {leaf.findings?.length > 0 && (
        <div className="leaf-section">
          <span className="leaf-section-label">Findings</span>
          <ul className="leaf-list">
            {leaf.findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {leaf.benchmarks?.length > 0 && (
        <div className="leaf-section">
          <span className="leaf-section-label">Benchmarks</span>
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
        <div className="leaf-section">
          <span className="leaf-section-label">Limitations</span>
          <ul className="leaf-list">
            {leaf.limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}

      <div className="leaf-section">
        <span className="leaf-section-label">Implications</span>
        <p className="leaf-section-body">{leaf.implications}</p>
      </div>

      <div className="leaf-section leaf-section--editable">
        <span className="leaf-section-label">Practical Application <span className="leaf-editable-hint">edit this</span></span>
        <textarea
          className="leaf-practical-input"
          value={leaf.practical_application || ''}
          onChange={e => updatePractical(e.target.value)}
          rows={4}
        />
      </div>

      {leaf.open_questions?.length > 0 && (
        <div className="leaf-section">
          <span className="leaf-section-label">Open Questions</span>
          <ul className="leaf-list">
            {leaf.open_questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {leaf.tags?.length > 0 && (
        <div className="leaf-tags">
          {leaf.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
    </div>
  )
}

export default function Digest({ garden, onEntriesSaved }) {
  const [mode, setMode] = useState('url') // url | paste
  const [url, setUrl] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [stage, setStage] = useState('idle') // idle | loading | review | saving | done
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [editedLeaf, setEditedLeaf] = useState(null)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState(null)

  const isLeaf = result?.type === 'paper'

  async function handleExtract() {
    const isUrl = mode === 'url'
    if (isUrl && !url.trim()) return
    if (!isUrl && !pasteText.trim()) return

    setStage('loading')
    setError(null)
    setResult(null)

    try {
      const body = isUrl
        ? { url: url.trim(), garden }
        : { text: pasteText.trim(), title: pasteTitle.trim() || 'Pasted content', garden }

      const res = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.hint === 'paste') {
          setMode('paste')
          if (url.trim()) setPasteTitle(url.trim())
        }
        throw new Error(data.error || 'Extraction failed')
      }
      setResult(data)
      if (data.leaf) {
        setEditedLeaf(data.leaf)
      } else if (data.candidates) {
        setSelected(new Set(data.candidates.map((_, i) => i)))
      }
      setStage('review')
    } catch (e) {
      setError(e.message)
      setStage('idle')
    }
  }

  function toggle(i) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === result.candidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(result.candidates.map((_, i) => i)))
    }
  }

  async function handleSaveLeaf() {
    setStage('saving')
    const { embedding, ...leafFields } = editedLeaf
    try {
      const r = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          type: 'leaf',
          content: JSON.stringify(leafFields),
          category: null,
          tags: editedLeaf.tags || [],
          embedding,
          garden
        })
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (${r.status})`)
      }
      setSavedCount(1)
      setStage('done')
      if (onEntriesSaved) onEntriesSaved()
    } catch (e) {
      setError(e.message)
      setStage('review')
    }
  }

  async function handleSaveSeeds() {
    if (selected.size === 0) return
    setStage('saving')

    const toSave = [...selected].map(i => result.candidates[i])

    try {
      await Promise.all(
        toSave.map(async c => {
          const r = await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: crypto.randomUUID(),
              type: 'seed',
              content: c.content,
              category: c.category,
              tags: c.tags,
              embedding: c.embedding,
              garden
            })
          })
          if (!r.ok) {
            const body = await r.json().catch(() => ({}))
            throw new Error(body.error || `Save failed (${r.status})`)
          }
        })
      )
      setSavedCount(toSave.length)
      setStage('done')
      if (onEntriesSaved) onEntriesSaved()
    } catch (e) {
      setError(e.message)
      setStage('review')
    }
  }

  function reset() {
    setUrl('')
    setPasteTitle('')
    setPasteText('')
    setStage('idle')
    setResult(null)
    setSelected(new Set())
    setEditedLeaf(null)
    setError(null)
    setSavedCount(0)
  }

  if (stage === 'done') {
    return (
      <div className="digest">
        <div className="saved-state">
          <p className="saved-msg">
            {isLeaf
              ? 'leaf planted.'
              : `${savedCount} ${savedCount === 1 ? 'seed' : 'seeds'} planted.`}
          </p>
          <button className="capture-another" onClick={reset}>digest another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="digest">
      <div className="digest-mode-row">
        <div className="type-toggle">
          <button className={`tog${mode === 'url' ? ' active' : ''}`} onClick={() => { setMode('url'); setError(null) }}>url</button>
          <button className={`tog${mode === 'paste' ? ' active' : ''}`} onClick={() => { setMode('paste'); setError(null) }}>paste</button>
        </div>
        <p className="digest-mode-hint">
          {mode === 'url' ? 'youtube, articles, papers, github' : 'transcripts, show notes, tiktoks, anything'}
        </p>
      </div>

      {mode === 'url' ? (
        <div className="digest-url-row">
          <input
            className="digest-url-input"
            type="url"
            placeholder="paste a url…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && stage === 'idle' && handleExtract()}
            disabled={stage === 'loading'}
          />
          <button
            className="analyse-btn"
            onClick={handleExtract}
            disabled={!url.trim() || stage === 'loading' || stage === 'saving'}
          >
            {stage === 'loading' ? 'extracting…' : 'extract'}
          </button>
        </div>
      ) : (
        <div className="digest-paste-block">
          <input
            className="digest-url-input"
            type="text"
            placeholder="title (optional — podcast name, episode title…)"
            value={pasteTitle}
            onChange={e => setPasteTitle(e.target.value)}
            disabled={stage === 'loading'}
          />
          <textarea
            className="content-input"
            placeholder="paste transcript, show notes, or any text…"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={10}
            disabled={stage === 'loading'}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="analyse-btn"
              onClick={handleExtract}
              disabled={!pasteText.trim() || stage === 'loading' || stage === 'saving'}
            >
              {stage === 'loading' ? 'extracting…' : 'extract'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {stage === 'loading' && (
        <div className="digest-loading">
          <p className="step-status">fetching content and extracting knowledge…</p>
        </div>
      )}

      {(stage === 'review' || stage === 'saving') && result && (
        <>
          <div className="digest-source">
            <span className="digest-source-type">{result.type}</span>
            <span className="digest-source-title">{result.title}</span>
          </div>

          {isLeaf ? (
            <>
              <LeafReview leaf={editedLeaf} onLeafChange={setEditedLeaf} />
              <div className="save-row">
                <button className="back-btn" onClick={reset}>← start over</button>
                <button
                  className="save-btn"
                  onClick={handleSaveLeaf}
                  disabled={stage === 'saving'}
                >
                  {stage === 'saving' ? 'saving…' : 'plant this leaf'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="digest-controls">
                <p className="digest-instruction">select the seeds to add to your garden</p>
                <button className="digest-toggle-all" onClick={toggleAll}>
                  {selected.size === result.candidates.length ? 'deselect all' : 'select all'}
                </button>
              </div>

              <div className="digest-candidates">
                {result.candidates.map((c, i) => {
                  const color = CATEGORY_COLORS[c.category] || '#666'
                  const isSelected = selected.has(i)
                  return (
                    <div
                      key={i}
                      className={`digest-candidate${isSelected ? ' selected' : ''}`}
                      onClick={() => toggle(i)}
                    >
                      <div className="digest-check">{isSelected ? '✓' : ''}</div>
                      <div className="digest-candidate-body">
                        <div className="classification">
                          <span className="category-badge" style={{ '--cat-color': color }}>{c.category}</span>
                          <div className="tags">
                            {(c.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
                          </div>
                        </div>
                        <p className="digest-candidate-content">{c.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="save-row">
                <button className="back-btn" onClick={reset}>← start over</button>
                <button
                  className="save-btn"
                  onClick={handleSaveSeeds}
                  disabled={selected.size === 0 || stage === 'saving'}
                >
                  {stage === 'saving' ? 'saving…' : `plant ${selected.size} ${selected.size === 1 ? 'seed' : 'seeds'}`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
