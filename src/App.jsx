import { useState, useEffect } from 'react'
import Capture from './components/Capture'
import Garden from './components/Garden'
import Questions from './components/Questions'
import Ideas from './components/Ideas'
import Discover from './components/Discover'
import Digest from './components/Digest'
import Ask from './components/Ask'

export default function App() {
  const [view, setView] = useState('capture')
  const [garden, setGarden] = useState('ai')
  const [entries, setEntries] = useState([])
  const [openQuestions, setOpenQuestions] = useState([])
  const [respondingTo, setRespondingTo] = useState(null)
  const [seedContent, setSeedContent] = useState(null)

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

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-title" onClick={() => { setView('capture'); setRespondingTo(null) }}>knowledge garden</span>
        <div className="garden-switcher">
          <button className={garden === 'ai' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('ai')}>ai + tech</button>
          <button className={garden === 'world' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('world')}>world</button>
        </div>
        <div className="nav-links">
          <button className={view === 'capture' ? 'active' : ''} onClick={() => { setView('capture'); setRespondingTo(null) }}>capture</button>
          <button className={view === 'garden' ? 'active' : ''} onClick={() => setView('garden')}>garden</button>
          <button className={view === 'questions' ? 'active' : ''} onClick={() => setView('questions')}>
            carrying {openQuestions.length > 0 && <span className="q-count">{openQuestions.length}</span>}
          </button>
          <button className={view === 'discover' ? 'active' : ''} onClick={() => setView('discover')}>discover</button>
          <button className={view === 'digest' ? 'active' : ''} onClick={() => setView('digest')}>digest</button>
          <button className={view === 'ask' ? 'active' : ''} onClick={() => setView('ask')}>ask</button>
          <button className={view === 'ideas' ? 'active' : ''} onClick={() => setView('ideas')}>ideas</button>
        </div>
      </nav>
      <main>
        {view === 'capture' && (
          <Capture
            garden={garden}
            openQuestions={openQuestions}
            onSaved={(entry, question, closedIds) => { setSeedContent(null); handleEntrySaved(entry, question, closedIds) }}
            respondingTo={respondingTo}
            seedContent={seedContent}
            onSeedConsumed={() => setSeedContent(null)}
          />
        )}
        {view === 'garden' && <Garden entries={entries} openQuestions={openQuestions} onEntryUpdated={handleEntryUpdated} />}
        {view === 'questions' && (
          <Questions questions={openQuestions} entries={entries} onClose={handleQuestionClosed} onRespond={handleRespond} />
        )}
        {view === 'discover' && <Discover garden={garden} onSeed={handleSeed} />}
        {view === 'digest' && <Digest garden={garden} onEntriesSaved={fetchAll} />}
        {view === 'ask' && <Ask garden={garden} />}
        {view === 'ideas' && <Ideas />}
      </main>
    </div>
  )
}
