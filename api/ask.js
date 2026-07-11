import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { question, garden = 'ai' } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question required' })

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: question })
  })
  const embedData = await embedRes.json()
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  const embedding = embedData.data[0].embedding
  const sql = neon(process.env.DATABASE_URL)
  const embeddingStr = JSON.stringify(embedding)

  // Hybrid search: vector + full-text, fused with RRF (k=60)
  // Each leg returns up to 20 candidates; RRF re-ranks by combined position
  const entries = await sql`
    WITH vector_search AS (
      SELECT id, content, category, tags,
             1 - (embedding <-> ${embeddingStr}::vector) AS similarity,
             ROW_NUMBER() OVER (ORDER BY embedding <-> ${embeddingStr}::vector) AS rn
      FROM entries
      WHERE garden = ${garden}
        AND 1 - (embedding <-> ${embeddingStr}::vector) > 0.3
      ORDER BY embedding <-> ${embeddingStr}::vector
      LIMIT 20
    ),
    fts_search AS (
      SELECT id, content, category, tags,
             ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${question})) AS fts_score,
             ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${question})) DESC) AS rn
      FROM entries
      WHERE garden = ${garden}
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${question})
      LIMIT 20
    ),
    rrf AS (
      SELECT
        COALESCE(v.id, f.id) AS id,
        COALESCE(v.content, f.content) AS content,
        COALESCE(v.category, f.category) AS category,
        COALESCE(v.tags, f.tags) AS tags,
        COALESCE(v.similarity, 0) AS similarity,
        COALESCE(1.0 / (60 + v.rn), 0) + COALESCE(1.0 / (60 + f.rn), 0) AS rrf_score
      FROM vector_search v
      FULL OUTER JOIN fts_search f ON v.id = f.id
    )
    SELECT id, content, category, tags, similarity, rrf_score
    FROM rrf
    ORDER BY rrf_score DESC
    LIMIT 8
  `

  if (entries.length === 0) {
    return res.json({
      answer: "I don't know yet — your garden doesn't have anything on this topic. Keep capturing and it will grow.",
      sources: []
    })
  }

  const context = entries
    .map((e, i) => `[${i + 1}] ${e.content}`)
    .join('\n\n')

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: `You are a thoughtful assistant helping someone explore their personal knowledge garden. Answer their question using only the entries provided. Cite entries by number like [1] or [2]. Be concise and direct. If the entries don't fully address the question, say so honestly.`,
      messages: [{
        role: 'user',
        content: `Here are relevant entries from my knowledge garden:\n\n${context}\n\nQuestion: ${question}`
      }]
    })
  })

  const claudeData = await claudeRes.json()
  if (!claudeRes.ok) return res.status(500).json({ error: claudeData })

  const answer = claudeData.content[0].text

  return res.json({
    answer,
    sources: entries.map(e => ({
      id: e.id,
      content: e.content,
      category: e.category,
      tags: e.tags,
      similarity: e.similarity,
      rrf_score: e.rrf_score
    }))
  })
}
