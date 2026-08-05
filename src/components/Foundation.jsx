import { useState, useEffect } from 'react'
import { calculateFoundationCoverage } from '../utils/zettelkasten-discovery.js'

const COVERAGE_LABEL = { covered: 'covered', shallow: 'shallow', gap: 'gap' }

function CoverageBar({ nodes }) {
  const covered = nodes.filter(n => n.coverage === 'covered').length
  const shallow = nodes.filter(n => n.coverage === 'shallow').length
  const gap = nodes.filter(n => n.coverage === 'gap').length
  const total = nodes.length
  if (total === 0) return null
  return (
    <div className="fn-coverage-bar-wrap">
      <div className="fn-coverage-bar">
        {covered > 0 && <div className="fn-bar-seg fn-bar-covered" style={{ width: `${(covered / total) * 100}%` }} />}
        {shallow > 0 && <div className="fn-bar-seg fn-bar-shallow" style={{ width: `${(shallow / total) * 100}%` }} />}
        {gap > 0 && <div className="fn-bar-seg fn-bar-gap" style={{ width: `${(gap / total) * 100}%` }} />}
      </div>
      <div className="fn-coverage-legend">
        <span className="fn-leg fn-leg-covered">{covered} covered</span>
        <span className="fn-leg fn-leg-shallow">{shallow} shallow</span>
        <span className="fn-leg fn-leg-gap">{gap} gap{gap !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

export default function Foundation({ garden, onCapture, onDiscover }) {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newConcept, setNewConcept] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [discoveryMetrics, setDiscoveryMetrics] = useState(null)
  const [discoveryLoading, setDiscoveryLoading] = useState(true)

  useEffect(() => {
    load()
    loadDiscoveryMetrics()
  }, [garden])

  async function load() {
    setLoading(true)
    const data = await fetch(`/api/foundation?garden=${garden}`).then(r => r.json())
    setNodes(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function loadDiscoveryMetrics() {
    setDiscoveryLoading(true)
    try {
      const metrics = await calculateFoundationCoverage(garden)
      setDiscoveryMetrics(metrics)
    } catch (error) {
      console.error('Failed to load discovery metrics:', error)
      setDiscoveryMetrics(null)
    }
    setDiscoveryLoading(false)
  }

  async function generate() {
    setGenerating(true)
    const { nodes: suggested } = await fetch('/api/foundation-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garden })
    }).then(r => r.json())

    // Save all suggested nodes
    const saved = []
    for (const n of suggested) {
      const row = await fetch('/api/foundation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garden, concept: n.concept, description: n.description })
      }).then(r => r.json())
      saved.push(row)
    }
    setNodes(prev => [...prev, ...saved])
    setGenerating(false)
  }

  async function addNode() {
    if (!newConcept.trim()) return
    setSaving(true)
    const row = await fetch('/api/foundation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garden, concept: newConcept.trim(), description: newDesc.trim() || null })
    }).then(r => r.json())
    setNodes(prev => [...prev, row])
    setNewConcept('')
    setNewDesc('')
    setSaving(false)
    setAdding(false)
  }

  async function deleteNode(id) {
    await fetch('/api/foundation', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setNodes(prev => prev.filter(n => n.id !== id))
  }

  if (loading) return <div className="fn-loading">checking foundation…</div>

  return (
    <div className="foundation">
      <div className="fn-header">
        <div>
          <h2 className="fn-title">foundation</h2>
          <p className="fn-subtitle">the load-bearing concepts — everything else builds on these</p>
        </div>
        <div className="fn-header-actions">
          {nodes.length === 0 && (
            <button className="fn-generate-btn" onClick={generate} disabled={generating}>
              {generating ? 'generating…' : 'generate foundation'}
            </button>
          )}
          <button className="fn-add-btn" onClick={() => setAdding(a => !a)}>
            {adding ? 'cancel' : '+ add concept'}
          </button>
        </div>
      </div>

      {nodes.length > 0 && <CoverageBar nodes={nodes} />}

      {discoveryMetrics && (
        <div className="fn-discovery-metrics">
          <div className="fn-discovery-header">
            <h3>zettelkasten coverage</h3>
            <p>{discoveryMetrics.coveredFoundations} of {discoveryMetrics.totalFoundations} foundations linked ({discoveryMetrics.coveragePercent}%)</p>
          </div>
          <div className="fn-foundations-list">
            {discoveryMetrics.foundations.map(fn => (
              <div key={fn.id} className={`fn-foundation-item fn-foundation-${fn.isCovered ? 'covered' : 'empty'}`}>
                <div className="fn-foundation-status">{fn.isCovered ? '✅' : '❌'}</div>
                <div className="fn-foundation-info">
                  <span className="fn-foundation-name">{fn.name}</span>
                  <span className="fn-foundation-links">{fn.linkedCount} linked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding && (
        <div className="fn-add-form">
          <input
            className="fn-concept-input"
            value={newConcept}
            onChange={e => setNewConcept(e.target.value)}
            placeholder="concept name"
            autoFocus
          />
          <textarea
            className="fn-desc-input"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="one sentence — what this is and why it's foundational (optional)"
            rows={2}
          />
          <button className="fn-save-btn" onClick={addNode} disabled={saving || !newConcept.trim()}>
            {saving ? 'saving…' : 'add'}
          </button>
        </div>
      )}

      {nodes.length === 0 && !generating && (
        <p className="fn-empty">
          no foundation nodes yet. generate a suggested set or add your own.
        </p>
      )}

      {generating && (
        <div className="fn-generating">
          <p>thinking about what's load-bearing in this field…</p>
        </div>
      )}

      <div className="fn-grid">
        {nodes.map(node => (
          <div key={node.id} className={`fn-node fn-node--${node.coverage}`}>
            <div className="fn-node-header">
              <span className={`fn-badge fn-badge--${node.coverage}`}>{COVERAGE_LABEL[node.coverage]}</span>
              <button className="fn-delete-btn" onClick={() => deleteNode(node.id)} title="remove">×</button>
            </div>
            <h3 className="fn-node-concept">{node.concept}</h3>
            {node.description && <p className="fn-node-desc">{node.description}</p>}
            {node.entry_count > 0 && (
              <p className="fn-node-count">{node.entry_count} entr{node.entry_count === 1 ? 'y' : 'ies'}</p>
            )}
            <div className="fn-node-actions">
              {node.coverage !== 'covered' && (
                <button className="fn-action-btn fn-action-discover" onClick={() => onDiscover(node.concept)}>
                  discover →
                </button>
              )}
              <button className="fn-action-btn fn-action-capture" onClick={() => onCapture(node.concept)}>
                capture →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
