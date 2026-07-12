import { neon } from '@neondatabase/serverless'
import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'
import { trace } from '@opentelemetry/api'

initSentry()

export default withSpan('api.questions', async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)
  const span = trace.getActiveSpan()

  if (req.method === 'GET') {
    const garden = req.query.garden || 'ai'
    span?.setAttribute('garden.name', garden)

    const rows = await spanFn('postgres.select', { 'db.system': 'postgresql', 'db.operation': 'SELECT' }, async (s) => {
      const r = await sql`SELECT * FROM questions WHERE closed_at IS NULL AND garden = ${garden} ORDER BY created_at DESC`
      s.setAttribute('db.result_count', r.length)
      return r
    })

    await flushSentry()
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { entry_id, text, embedding, garden } = req.body
    if (!entry_id || !text) return res.status(400).json({ error: 'Missing required fields' })

    try {
      const row = await spanFn('postgres.insert', { 'db.system': 'postgresql', 'db.operation': 'INSERT' }, async () => {
        const embeddingStr = JSON.stringify(embedding)
        const g = garden || 'ai'
        const [r] = await sql`
          INSERT INTO questions (entry_id, text, embedding, garden)
          VALUES (${entry_id}, ${text}, ${embeddingStr}::vector, ${g})
          RETURNING *
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
  }

  if (req.method === 'DELETE') {
    const { ids, closed_by_entry_id } = req.body
    if (!ids?.length) return res.status(400).json({ error: 'No ids provided' })

    await spanFn('postgres.update', { 'db.system': 'postgresql', 'db.operation': 'UPDATE' }, async () => {
      await sql`
        UPDATE questions
        SET closed_at = now(), closed_by_entry_id = ${closed_by_entry_id ?? null}
        WHERE id = ANY(${ids}::uuid[])
      `
    })

    await flushSentry()
    return res.json({ ok: true })
  }

  return res.status(405).end()
})
