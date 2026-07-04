import { neon } from '@neondatabase/serverless'

function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

function centroid(vectors) {
  if (vectors.length === 0) return null
  const dim = vectors[0].length
  const sum = new Array(dim).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i]
  }
  return sum.map(x => x / vectors.length)
}

function parseRss(xml, limit = 30) {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(xml)) !== null && items.length < limit) {
    const block = m[1]
    const get = tag => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
      return (r.exec(block) || [])[1]?.replace(/<[^>]*>/g, '').trim()
    }
    const title = get('title')
    const link = get('link') || get('guid')
    const pubDate = get('pubDate')
    const time = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000)
    if (title && link?.startsWith('http')) {
      items.push({ id: link, title, url: link, time })
    }
  }
  return items
}

async function fetchWorldArticles() {
  const sources = [
    { url: 'https://feeds.reuters.com/reuters/worldNews', limit: 20 },
    { url: 'https://rsshub.app/apnews/topics/world-news', limit: 20 },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', limit: 20 },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', limit: 15 },
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', limit: 15 },
    { url: 'https://www.reddit.com/r/geopolitics/.rss', limit: 15 },
    { url: 'https://www.foreignaffairs.com/rss.xml', limit: 10 },
    { url: 'https://www.theguardian.com/world/rss', limit: 10 },
  ]
  const results = await Promise.allSettled(
    sources.map(({ url }) =>
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }).then(r => r.text())
    )
  )
  const all = []
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') all.push(...parseRss(results[i].value, sources[i].limit))
  }
  const seen = new Set()
  return all.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true })
}

async function fetchCultureArticles() {
  const sources = [
    'https://www.theguardian.com/culture/rss',
    'https://rss.nytimes.com/services/xml/rss/nyt/ReligionandBelief.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Society.xml'
  ]
  const results = await Promise.allSettled(
    sources.map(url =>
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }).then(r => r.text())
    )
  )
  const all = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...parseRss(r.value, 25))
  }
  const seen = new Set()
  return all.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true })
}

async function fetchAiArticles() {
  const [hnResult, arxivResult] = await Promise.allSettled([
    (async () => {
      const topIdsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      if (!topIdsRes.ok) return []
      const topIds = await topIdsRes.json()
      const storiesRaw = await Promise.all(
        topIds.slice(0, 40).map(id =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null)
        )
      )
      return storiesRaw
        .filter(s => s && s.type === 'story' && s.url && s.title)
        .map(s => ({ id: s.id, title: s.title, url: s.url, time: s.time, score: s.score || 0, comments: s.descendants || 0 }))
    })(),
    (async () => {
      const res = await fetch('https://arxiv.org/rss/cs.AI')
      if (!res.ok) return []
      return parseRss(await res.text(), 20)
    })()
  ])
  const hn = hnResult.status === 'fulfilled' ? hnResult.value : []
  const arxiv = arxivResult.status === 'fulfilled' ? arxivResult.value : []
  return [...hn, ...arxiv]
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const sql = neon(process.env.DATABASE_URL)
  const key = process.env.OPENAI_API_KEY
  const exaKey = process.env.EXA_API_KEY
  const garden = req.query.garden || 'ai'
  const concept = req.query.concept || null

  // Concept-specific: use Exa to search directly rather than reranking a fixed pool
  if (concept) {
    const exaRes = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': exaKey },
      body: JSON.stringify({
        query: concept,
        numResults: 10,
        type: 'neural',
        useAutoprompt: true,
        contents: { title: true }
      })
    })
    const exaData = await exaRes.json()
    if (!exaRes.ok) return res.status(500).json({ error: exaData })

    const articles = (exaData.results || []).map(r => ({
      id: r.id || r.url,
      title: r.title,
      url: r.url,
      time: r.publishedDate ? Math.floor(new Date(r.publishedDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
      relevance: r.score ?? null,
      score: 0,
      comments: 0
    }))
    return res.json(articles)
  }

  // Garden-wide: fetch from fixed sources and rank by garden centroid
  const articles = garden === 'world'
    ? await fetchWorldArticles()
    : garden === 'culture'
      ? await fetchCultureArticles()
      : await fetchAiArticles()

  if (articles.length === 0) return res.json([])

  const entries = await sql`
    SELECT embedding FROM entries
    WHERE garden = ${garden}
    ORDER BY created_at DESC
    LIMIT 20
  `

  if (entries.length === 0) {
    return res.json(articles.slice(0, 8).map(a => ({ ...a, relevance: null })))
  }

  const vectors = entries
    .map(e => {
      const raw = e.embedding
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
      return null
    })
    .filter(Boolean)

  if (vectors.length === 0) {
    return res.json(articles.slice(0, 8).map(a => ({ ...a, relevance: null })))
  }

  const center = centroid(vectors)

  const titles = articles.map(a => a.title)
  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: titles })
  })
  const embedData = await embedRes.json()
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  const embeddings = embedData.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding)

  const scored = articles.map((a, i) => ({ ...a, relevance: cosineSim(center, embeddings[i]) }))
  const maxScore = Math.max(...scored.map(a => a.score || 0), 1)
  const ranked = scored
    .map(a => ({ ...a, _rank: 0.6 * a.relevance + 0.4 * ((a.score || 0) / maxScore) }))
    .sort((a, b) => b._rank - a._rank)

  res.json(ranked.slice(0, 10))
}
