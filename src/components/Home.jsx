import { useState, useEffect, useRef } from 'react'
import Garden from './Garden'
import { exportEntryToZettelkasten } from '../utils/zettelkasten-export.js'

export default function Home({ garden, entries, onEntrySaved, onEntryUpdated, seedContent, onSeedConsumed }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [capturedFlash, setCapturedFlash] = useState(false)
  const [classifying, setClassifying] = useState(new Set())
  const [entryConnections, setEntryConnections] = useState(new Map())
  const [showFoundation, setShowFoundation] = useState(false)
  const textareaRef = useRef(null)
  const flashTimerRef = useRef(null)

  useEffect(() => {
    if (seedContent) {
      setContent(seedContent)
      textareaRef.current?.focus()
      onSeedConsumed?.()
    }
  }, [seedContent])

  useEffect(() => {
    return () => clearTimeout(flashTimerRef.current)
  }, [])

  async function classifyInBackground(entryId, text, gardenName) {
    try {
      const res = await fetch('/api/agent-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, garden: gardenName })
      })
      if (!res.ok) throw new Error('classify failed')

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

          if (event.type === 'result') {
            const { category, tags, embedding, relatedEntries, contradictions, suggestedQuestions } = event.data

            // Patch entry in DB with classification
            fetch('/api/entries', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: entryId, category, tags, embedding })
            }).then(r => r.json()).then(updated => {
              if (updated?.id) onEntryUpdated(updated)
            }).catch(() => {})

            // Store connections locally
            if (relatedEntries?.length > 0 || contradictions?.length > 0 || suggestedQuestions?.length > 0) {
              setEntryConnections(prev => {
                const next = new Map(prev)
                next.set(entryId, { related: relatedEntries || [], contradictions: contradictions || [], suggestedQuestions: suggestedQuestions || [] })
                return next
              })
            }

            setClassifying(prev => {
              const next = new Set(prev)
              next.delete(entryId)
              return next
            })
          }
        }
      }
    } catch {
      // Silent fail — entry stays unclassified, no crash
      setClassifying(prev => {
        const next = new Set(prev)
        next.delete(entryId)
        return next
      })
    }
  }

  async function handleSave() {
    if (!content.trim() || saving) return
    setSaving(true)

    try {
      const entryId = crypto.randomUUID()
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, type: 'note', content: content.trim(), garden })
      })
      if (!res.ok) throw new Error('save failed')
      const entry = await res.json()

      onEntrySaved(entry)
      exportEntryToZettelkasten(entry).catch(() => {})

      setContent('')
      setCapturedFlash(true)
      clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setCapturedFlash(false), 2000)
      textareaRef.current?.focus()

      setClassifying(prev => new Set([...prev, entryId]))
      classifyInBackground(entryId, entry.content, garden)
    } catch {
      // keep content, let user retry
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="home">
      <div className="compose-area">
        {capturedFlash && <span className="captured-flash">captured.</span>}
        <textarea
          ref={textareaRef}
          className="compose-input"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="what are you thinking…"
          rows={4}
          disabled={saving}
          autoFocus
        />
        <button
          className="compose-save-btn"
          onClick={handleSave}
          disabled={!content.trim() || saving}
        >
          {saving ? 'saving…' : 'save →'}
        </button>
      </div>

      <Garden
        entries={entries}
        onEntryUpdated={onEntryUpdated}
        classifying={classifying}
        entryConnections={entryConnections}
      />
    </div>
  )
}
