import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Capture from './components/Capture'
import Garden from './components/Garden'
import Questions from './components/Questions'

export default function App() {
  const [view, setView] = useState('capture')
  const [entries, setEntries] = useState([])
  const [openQuestions, setOpenQuestions] = useState([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [{ data: e }, { data: q }] = await Promise.all([
      supabase.from('entries').select('*').order('created_at', { ascending: false }),
      supabase.from('questions').select('*').is('closed_at', null).order('created_at', { ascending: false })
    ])
    if (e) setEntries(e)
    if (q) setOpenQuestions(q)
  }

  function handleEntrySaved(newEntry, newQuestion, closedIds) {
    setEntries(prev => [newEntry, ...prev])
    setOpenQuestions(prev => {
      const remaining = prev.filter(q => !closedIds.has(q.id))
      return [newQuestion, ...remaining]
    })
  }

  function handleQuestionClosed(questionId) {
    setOpenQuestions(prev => prev.filter(q => q.id !== questionId))
  }

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-title" onClick={() => setView('capture')}>knowledge garden</span>
        <div className="nav-links">
          <button className={view === 'capture' ? 'active' : ''} onClick={() => setView('capture')}>capture</button>
          <button className={view === 'garden' ? 'active' : ''} onClick={() => setView('garden')}>garden</button>
          <button className={view === 'questions' ? 'active' : ''} onClick={() => setView('questions')}>
            carrying {openQuestions.length > 0 && <span className="q-count">{openQuestions.length}</span>}
          </button>
        </div>
      </nav>
      <main>
        {view === 'capture' && (
          <Capture openQuestions={openQuestions} onSaved={handleEntrySaved} />
        )}
        {view === 'garden' && <Garden entries={entries} />}
        {view === 'questions' && (
          <Questions questions={openQuestions} entries={entries} onClose={handleQuestionClosed} />
        )}
      </main>
    </div>
  )
}
