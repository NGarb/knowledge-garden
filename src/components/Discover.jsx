import { useState, useEffect } from 'react'

function timeAgo(unixTime) {
  const diff = Math.floor(Date.now() / 1000) - unixTime
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return '' }
}

export default function Discover({ onSeed, garden }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [garden])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/discover?garden=${garden}`)
      const data = await res.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      setArticles(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const subtitle = garden === 'world'
    ? 'articles from international news, ranked by how closely they connect to your garden'
    : 'stories from hacker news and arxiv, ranked by how closely they connect to your garden'

  return (
    <div className="discover">
      <div className="discover-header">
        <p className="discover-subtitle">
          {subtitle}
        </p>
        <button className="refresh-btn" onClick={load} disabled={loading}>
          {loading ? 'loading…' : '↺ refresh'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="discover-loading">
          <p className="discover-loading-msg">finding articles…</p>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <p className="discover-empty">nothing found right now — try refreshing.</p>
      )}

      {!loading && articles.length > 0 && (
        <div className="discover-feed">
          {articles.map(article => (
            <div key={article.id} className="discover-card">
              <div className="discover-card-meta">
                <span className="discover-domain">{domain(article.url)}</span>
                <span className="discover-dot">·</span>
                <span className="discover-time">{timeAgo(article.time)}</span>
                {article.relevance !== null && (
                  <>
                    <span className="discover-dot">·</span>
                    <span className="discover-relevance">{Math.round(article.relevance * 100)}% match</span>
                  </>
                )}
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="discover-title"
              >
                {article.title}
              </a>
              <div className="discover-actions">
                <button
                  className="plant-btn"
                  onClick={() => onSeed(article.title, article.url)}
                >
                  plant this →
                </button>
                {article.comments > 0 && (
                  <a
                    href={`https://news.ycombinator.com/item?id=${article.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hn-comments-link"
                  >
                    {article.comments} comments
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
