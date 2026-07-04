import { useState, useEffect } from 'react'
import Capture from './components/Capture'
import Garden from './components/Garden'
import Questions from './components/Questions'
import Discover from './components/Discover'
import Digest from './components/Digest'
import Ask from './components/Ask'
import Foundation from './components/Foundation'

export default function App() {
  const [view, setView] = useState('capture')
  const [exploreTab, setExploreTab] = useState('ask')
  const [shapeTab, setShapeTab] = useState('garden')
  const [garden, setGarden] = useState('ai')
  const [entries, setEntries] = useState([])
  const [openQuestions, setOpenQuestions] = useState([])
  const [respondingTo, setRespondingTo] = useState(null)
  const [seedContent, setSeedContent] = useState(null)
  const [discoverConcept, setDiscoverConcept] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [garden])

  async function fetchAll() {
    const [entries, questions] = await Promise.all([
      fetch(`/api/entries?garden=${garden}`).then(r => r.json()),
      fetch(`/api/questions?garden=${garden}`).then(r => r.json())
    ])
    if (Array.isArray(entries)) setEntries(entries)
    if (Array.isArray(questions)) setOpenQuestions(questions)
  }

  function handleEntrySaved(newEntry, newQuestion, closedIds) {
    setEntries(prev => [newEntry, ...prev])
    setOpenQuestions(prev => {
      const remaining = prev.filter(q => !closedIds.has(q.id))
      if (newQuestion) return [newQuestion, ...remaining]
      return remaining
    })
    setRespondingTo(null)
  }

  function handleEntryUpdated(updatedEntry) {
    setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e))
  }

  function handleQuestionClosed(questionId) {
    setOpenQuestions(prev => prev.filter(q => q.id !== questionId))
  }

  function handleRespond(question) {
    setRespondingTo(question)
    setView('capture')
  }

  function handleSeed(title, url) {
    setSeedContent(`${title}\n${url}\n\n`)
    setRespondingTo(null)
    setView('capture')
  }

  function goToDiscover(concept) {
    setDiscoverConcept(concept)
    setExploreTab('discover')
    setView('explore')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <span className="sidebar-title" onClick={() => { setView('capture'); setRespondingTo(null) }}>
          knowledge garden
        </span>

        <nav className="sidebar-nav">
          <button
            className={view === 'capture' ? 'sidebar-tab active' : 'sidebar-tab'}
            onClick={() => { setView('capture'); setRespondingTo(null) }}
          >
            capture
            {openQuestions.length > 0 && <span className="q-count">{openQuestions.length}</span>}
          </button>

          <button
            className={view === 'explore' ? 'sidebar-tab active' : 'sidebar-tab'}
            onClick={() => setView('explore')}
          >
            explore
          </button>
          {view === 'explore' && (
            <div className="sidebar-subtabs">
              <button className={exploreTab === 'ask' ? 'sidebar-subtab active' : 'sidebar-subtab'} onClick={() => setExploreTab('ask')}>ask</button>
              <button className={exploreTab === 'discover' ? 'sidebar-subtab active' : 'sidebar-subtab'} onClick={() => { setDiscoverConcept(null); setExploreTab('discover') }}>discover</button>
              <button className={exploreTab === 'digest' ? 'sidebar-subtab active' : 'sidebar-subtab'} onClick={() => setExploreTab('digest')}>digest</button>
            </div>
          )}

          <button
            className={view === 'shape' ? 'sidebar-tab active' : 'sidebar-tab'}
            onClick={() => setView('shape')}
          >
            shape
          </button>
          {view === 'shape' && (
            <div className="sidebar-subtabs">
              <button className={shapeTab === 'garden' ? 'sidebar-subtab active' : 'sidebar-subtab'} onClick={() => setShapeTab('garden')}>garden</button>
              <button className={shapeTab === 'foundation' ? 'sidebar-subtab active' : 'sidebar-subtab'} onClick={() => setShapeTab('foundation')}>foundation</button>
              <button className={shapeTab === 'questions' ? 'sidebar-subtab active' : 'sidebar-subtab'} onClick={() => setShapeTab('questions')}>
                questions {openQuestions.length > 0 && <span className="q-count">{openQuestions.length}</span>}
              </button>
            </div>
          )}
        </nav>

        <div className="sidebar-garden-switcher">
          <span className="sidebar-section-label">garden</span>
          <button className={garden === 'ai' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('ai')}>ai + tech</button>
          <button className={garden === 'world' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('world')}>world</button>
          <button className={garden === 'culture' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('culture')}>culture</button>
        </div>
      </aside>

      <main className="main-content">
        {view === 'capture' && (
          <div className="capture-shell">
            {openQuestions.length > 0 && (
              <div className="carrying-bar">
                <span className="carrying-label">carrying</span>
                <button
                  className="carrying-link"
                  onClick={() => { setShapeTab('questions'); setView('shape') }}
                >
                  {openQuestions.length} open question{openQuestions.length !== 1 ? 's' : ''} →
                </button>
              </div>
            )}
            <Capture
              garden={garden}
              openQuestions={openQuestions}
              onSaved={(entry, question, closedIds) => { setSeedContent(null); handleEntrySaved(entry, question, closedIds) }}
              respondingTo={respondingTo}
              seedContent={seedContent}
              onSeedConsumed={() => setSeedContent(null)}
            />
          </div>
        )}

        {view === 'explore' && (
          <>
            {exploreTab === 'ask' && <Ask garden={garden} />}
            {exploreTab === 'discover' && <Discover garden={garden} concept={discoverConcept} onSeed={handleSeed} />}
            {exploreTab === 'digest' && <Digest garden={garden} onEntriesSaved={fetchAll} />}
          </>
        )}

        {view === 'shape' && (
          <>
            {shapeTab === 'garden' && <Garden entries={entries} openQuestions={openQuestions} onEntryUpdated={handleEntryUpdated} />}
            {shapeTab === 'foundation' && (
              <Foundation
                garden={garden}
                onCapture={concept => { setSeedContent(`${concept}\n\n`); setView('capture') }}
                onDiscover={goToDiscover}
              />
            )}
            {shapeTab === 'questions' && (
              <Questions questions={openQuestions} entries={entries} onClose={handleQuestionClosed} onRespond={handleRespond} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
