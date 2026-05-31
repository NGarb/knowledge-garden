import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM entries ORDER BY created_at DESC`
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { id, type, content, category, tags, embedding } = req.body
    if (!type || !content) return res.status(400).json({ error: 'Missing required fields' })
    const embeddingStr = JSON.stringify(embedding)
    const [row] = await sql`
      INSERT INTO entries (id, type, content, category, tags, embedding)
      VALUES (
        ${id ?? null}::uuid,
        ${type},
        ${content},
        ${category ?? null},
        ${tags ?? null},
        ${embeddingStr}::vector
      )
      RETURNING id, type, content, category, tags, created_at
    `
    return res.json(row)
  }

  res.status(405).end()
}
