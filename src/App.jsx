import { useState, useEffect } from 'react'
import Home from './components/Home'
import Ask from './components/Ask'
import Discover from './components/Discover'
import Digest from './components/Digest'
import Foundation from './components/Foundation'

export default function App() {
  const [view, setView] = useState('home')
  const [exploreTab, setExploreTab] = useState('ask')
  const [garden, setGarden] = useState('ai')
  const [entries, setEntries] = useState([])
  const [seedContent, setSeedContent] = useState(null)
  const [discoverConcept, setDiscoverConcept] = useState(null)
  const [showFoundation, setShowFoundation] = useState(false)

  useEffect(() => {
    fetchEntries()
  }, [garden])

  async function fetchEntries() {
    const res = await fetch(`/api/entries?garden=${garden}`)
    const data = await res.json()
    if (Array.isArray(data)) setEntries(data)
  }

  function handleEntrySaved(newEntry) {
    setEntries(prev => [newEntry, ...prev])
  }

  function handleEntryUpdated(updatedEntry) {
    setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e))
  }

  function handleSeed(title, url) {
    setSeedContent(`${title}\n${url}\n\n`)
    setView('home')
  }

  function goToDiscover(concept) {
    setDiscoverConcept(concept)
    setExploreTab('discover')
    setView('explore')
  }

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <span className="sidebar-title" onClick={() => setView('home')}>
          knowledge garden
        </span>

        <nav className="sidebar-nav">
          <button
            className={view === 'home' ? 'sidebar-tab active' : 'sidebar-tab'}
            onClick={() => setView('home')}
          >
            home
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
        </nav>

        <div className="sidebar-garden-switcher">
          <span className="sidebar-section-label">garden</span>
          <button className={garden === 'ai' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('ai')}>ai + tech</button>
          <button className={garden === 'world' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('world')}>world</button>
          <button className={garden === 'culture' ? 'gs-btn active' : 'gs-btn'} onClick={() => setGarden('culture')}>culture</button>
        </div>

        <button className="sidebar-foundation-btn" onClick={() => setShowFoundation(true)}>
          foundation ⚙
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="mobile-top-bar">
        <span className="mobile-title" onClick={() => setView('home')}>
          knowledge garden
        </span>
        <div className="mobile-top-bar-right">
          <div className="mobile-garden-switcher">
            <button className={garden === 'ai' ? 'mobile-gs active' : 'mobile-gs'} onClick={() => setGarden('ai')}>ai</button>
            <button className={garden === 'world' ? 'mobile-gs active' : 'mobile-gs'} onClick={() => setGarden('world')}>world</button>
            <button className={garden === 'culture' ? 'mobile-gs active' : 'mobile-gs'} onClick={() => setGarden('culture')}>culture</button>
          </div>
          <button className="mobile-gear-btn" onClick={() => setShowFoundation(true)}>⚙</button>
        </div>
      </div>

      <main className="main-content">
        {/* Explore sub-tabs (mobile) */}
        {view === 'explore' && (
          <div className="mobile-subtab-bar">
            <button className={exploreTab === 'ask' ? 'mobile-subtab active' : 'mobile-subtab'} onClick={() => setExploreTab('ask')}>ask</button>
            <button className={exploreTab === 'discover' ? 'mobile-subtab active' : 'mobile-subtab'} onClick={() => { setDiscoverConcept(null); setExploreTab('discover') }}>discover</button>
            <button className={exploreTab === 'digest' ? 'mobile-subtab active' : 'mobile-subtab'} onClick={() => setExploreTab('digest')}>digest</button>
          </div>
        )}

        {view === 'home' && (
          <Home
            garden={garden}
            entries={entries}
            onEntrySaved={handleEntrySaved}
            onEntryUpdated={handleEntryUpdated}
            seedContent={seedContent}
            onSeedConsumed={() => setSeedContent(null)}
          />
        )}

        {view === 'explore' && (
          <>
            {exploreTab === 'ask' && <Ask garden={garden} onCaptureDelta={content => { setSeedContent(content); setView('home') }} />}
            {exploreTab === 'discover' && <Discover garden={garden} concept={discoverConcept} onSeed={handleSeed} />}
            {exploreTab === 'digest' && <Digest garden={garden} onEntriesSaved={fetchEntries} />}
          </>
        )}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="bottom-tab-bar">
        <button
          className={view === 'home' ? 'bottom-tab active' : 'bottom-tab'}
          onClick={() => setView('home')}
        >
          home
        </button>
        <button
          className={view === 'explore' ? 'bottom-tab active' : 'bottom-tab'}
          onClick={() => setView('explore')}
        >
          explore
        </button>
      </nav>

      {/* Foundation overlay */}
      {showFoundation && (
        <div className="foundation-overlay">
          <div className="foundation-overlay-backdrop" onClick={() => setShowFoundation(false)} />
          <div className="foundation-overlay-sheet">
            <button className="foundation-overlay-close" onClick={() => setShowFoundation(false)}>close ×</button>
            <Foundation
              garden={garden}
              onCapture={concept => { setSeedContent(`${concept}\n\n`); setShowFoundation(false); setView('home') }}
              onDiscover={concept => { goToDiscover(concept); setShowFoundation(false) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
