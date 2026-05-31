import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const sql = neon(process.env.DATABASE_URL)
  const { id, content, embedding } = req.body
  if (!id || !content || !embedding) return res.status(400).json({ error: 'Missing required fields' })
  const embeddingStr = JSON.stringify(embedding)
  const [row] = await sql`
    UPDATE entries
    SET content = ${content}, embedding = ${embeddingStr}::vector
    WHERE id = ${id}
    RETURNING id, type, content, category, tags, created_at
  `
  return res.json(row)
}
