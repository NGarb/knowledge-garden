import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT * FROM questions WHERE closed_at IS NULL ORDER BY created_at DESC
    `
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { entry_id, text, embedding } = req.body
    if (!entry_id || !text) return res.status(400).json({ error: 'Missing required fields' })
    const embeddingStr = JSON.stringify(embedding)
    const [row] = await sql`
      INSERT INTO questions (entry_id, text, embedding)
      VALUES (${entry_id}, ${text}, ${embeddingStr}::vector)
      RETURNING *
    `
    return res.json(row)
  }

  res.status(405).end()
}
