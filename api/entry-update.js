import { neon } from '@neondatabase/serverless'
import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'

initSentry()

export default withSpan('api.entry-update', async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sql = neon(process.env.DATABASE_URL)
  const { id, content, embedding } = req.body
  if (!id || !content || !embedding) return res.status(400).json({ error: 'Missing required fields' })

  try {
    const row = await spanFn('postgres.update', { 'db.system': 'postgresql', 'db.operation': 'UPDATE' }, async () => {
      const embeddingStr = JSON.stringify(embedding)
      const [r] = await sql`
        UPDATE entries
        SET content = ${content}, embedding = ${embeddingStr}::vector
        WHERE id = ${id}
        RETURNING id, type, content, category, tags, created_at
      `
      return r
    })
    await flushSentry()
    return res.json(row)
  } catch (e) {
    captureException(e)
    await flushSentry()
    return res.status(500).json({ error: e.message })
  }
})
