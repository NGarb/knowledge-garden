import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { question, garden = 'ai' } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question required' })

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  // Embed the question
  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: question })
  })
  const embedData = await embedRes.json()
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  const embedding = embedData.data[0].embedding

  // Find relevant entries via pgvector
  const sql = neon(process.env.DATABASE_URL)
  const embeddingStr = JSON.stringify(embedding)
  const entries = await sql`
    SELECT id, content, category, tags,
           1 - (embedding <-> ${embeddingStr}::vector) AS similarity
    FROM entries
    WHERE garden = ${garden}
      AND 1 - (embedding <-> ${embeddingStr}::vector) > 0.6
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT 6
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
    sources: entries.map(e => ({ id: e.id, content: e.content, category: e.category, tags: e.tags, similarity: e.similarity }))
  })
}
