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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const sql = neon(process.env.DATABASE_URL)
  const key = process.env.OPENAI_API_KEY

  // 1. Fetch recent entries' embeddings from DB
  const entries = await sql`
    SELECT embedding FROM entries
    ORDER BY created_at DESC
    LIMIT 20
  `

  // 2. Fetch HN top story IDs
  const topIdsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
  if (!topIdsRes.ok) return res.status(502).json({ error: 'Failed to fetch HN stories' })
  const topIds = await topIdsRes.json()

  // Fetch top 40 story details in parallel, filter to real articles with URLs
  const storyIds = topIds.slice(0, 40)
  const storiesRaw = await Promise.all(
    storyIds.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null)
    )
  )
  const articles = storiesRaw.filter(s => s && s.type === 'story' && s.url && s.title)

  if (articles.length === 0) return res.json([])

  // 3. If no garden entries yet, just return a selection of top articles
  if (entries.length === 0) {
    return res.json(
      articles.slice(0, 8).map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        by: s.by,
        time: s.time,
        score: s.score,
        relevance: null
      }))
    )
  }

  // 4. Compute centroid of garden embeddings
  const vectors = entries
    .map(e => {
      const raw = e.embedding
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') {
        // pgvector returns strings like "[0.1,0.2,...]"
        try { return JSON.parse(raw) } catch { return null }
      }
      return null
    })
    .filter(Boolean)

  if (vectors.length === 0) {
    return res.json(
      articles.slice(0, 8).map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        by: s.by,
        time: s.time,
        score: s.score,
        relevance: null
      }))
    )
  }

  const center = centroid(vectors)

  // 5. Batch-embed all article titles in one API call
  const titles = articles.map(s => s.title)
  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: titles })
  })
  const embedData = await embedRes.json()
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  // 6. Sort embeddings by index to align with articles array
  const embeddings = embedData.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding)

  // 7. Rank by cosine similarity to garden centroid
  const ranked = articles
    .map((s, i) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      by: s.by,
      time: s.time,
      score: s.score,
      relevance: cosineSim(center, embeddings[i])
    }))
    .sort((a, b) => b.relevance - a.relevance)

  res.json(ranked.slice(0, 8))
}
