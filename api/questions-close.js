import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const sql = neon(process.env.DATABASE_URL)
  const { ids, closed_by_entry_id } = req.body
  if (!ids?.length) return res.status(400).json({ error: 'No ids provided' })
  await sql`
    UPDATE questions
    SET closed_at = now(), closed_by_entry_id = ${closed_by_entry_id ?? null}
    WHERE id = ANY(${ids}::uuid[])
  `
  return res.json({ ok: true })
}
