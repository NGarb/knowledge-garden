import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const sql = neon(process.env.DATABASE_URL)
  const { embedding, threshold = 0.62, count = 5 } = req.body
  if (!embedding) return res.status(400).json({ error: 'embedding required' })
  const embeddingStr = JSON.stringify(embedding)
  const rows = await sql`
    SELECT id, text, entry_id, created_at,
           1 - (embedding <-> ${embeddingStr}::vector) AS similarity
    FROM questions
    WHERE closed_at IS NULL
      AND 1 - (embedding <-> ${embeddingStr}::vector) > ${threshold}
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${count}
  `
  return res.json(rows)
}
