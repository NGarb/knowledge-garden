import { neon } from '@neondatabase/serverless'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  if (req.method === 'GET') {
    const garden = req.query.garden || 'ai'
    const rows = await sql`SELECT * FROM entries WHERE garden = ${garden} ORDER BY created_at DESC`
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { id, type, content, category, tags, embedding, garden } = req.body
    if (!type || !content) return res.status(400).json({ error: 'Missing required fields' })
    const embeddingStr = JSON.stringify(embedding)
    const g = garden || 'ai'
    const entryId = id || randomUUID()
    try {
      const [row] = await sql`
        INSERT INTO entries (id, type, content, category, tags, embedding, garden)
        VALUES (
          ${entryId}::uuid,
          ${type},
          ${content},
          ${category ?? null},
          ${tags ?? null},
          ${embeddingStr}::vector,
          ${g}
        )
        RETURNING id, type, content, category, tags, garden, created_at
      `
      return res.json(row)
    } catch (e) {
      console.error('entries POST error:', e)
      return res.status(500).json({ error: e.message })
    }
  }

  res.status(405).end()
}
