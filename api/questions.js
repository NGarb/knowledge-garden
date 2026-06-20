import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  if (req.method === 'GET') {
    const garden = req.query.garden || 'ai'
    const rows = await sql`
      SELECT * FROM questions WHERE closed_at IS NULL AND garden = ${garden} ORDER BY created_at DESC
    `
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { entry_id, text, embedding, garden } = req.body
    if (!entry_id || !text) return res.status(400).json({ error: 'Missing required fields' })
    const embeddingStr = JSON.stringify(embedding)
    const g = garden || 'ai'
    const [row] = await sql`
      INSERT INTO questions (entry_id, text, embedding, garden)
      VALUES (${entry_id}, ${text}, ${embeddingStr}::vector, ${g})
      RETURNING *
    `
    return res.json(row)
  }

  res.status(405).end()
}
