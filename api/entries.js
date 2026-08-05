import { neon } from '@neondatabase/serverless'
import { randomUUID } from 'crypto'
import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'
import { trace } from '@opentelemetry/api'

initSentry()

export default withSpan('api.entries', async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)
  const span = trace.getActiveSpan()

  if (req.method === 'GET') {
    const garden = req.query.garden || 'ai'
    span?.setAttribute('garden.name', garden)

    const rows = await spanFn('postgres.select', { 'db.system': 'postgresql', 'db.operation': 'SELECT' }, async (s) => {
      const r = await sql`SELECT * FROM entries WHERE garden = ${garden} ORDER BY created_at DESC`
      s.setAttribute('db.result_count', r.length)
      return r
    })

    await flushSentry()
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { id, type, content, category, tags, embedding, garden } = req.body
    if (!type || !content) return res.status(400).json({ error: 'Missing required fields' })

    span?.setAttributes({ 'garden.name': garden || 'ai', 'entry.type': type })

    const embeddingStr = JSON.stringify(embedding)
    const g = garden || 'ai'
    const entryId = id || randomUUID()

    try {
      const row = await spanFn('postgres.insert', { 'db.system': 'postgresql', 'db.operation': 'INSERT' }, async () => {
        const [r] = await sql`
          INSERT INTO entries (id, type, content, category, tags, embedding, garden)
          VALUES (${entryId}::uuid, ${type}, ${content}, ${category ?? null}, ${tags ?? null}, ${embeddingStr}::vector, ${g})
          RETURNING id, type, content, category, tags, garden, created_at
        `
        return r
      })
      await flushSentry()
      return res.json(row)
    } catch (e) {
      console.error('entries POST error:', e)
      captureException(e)
      await flushSentry()
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'PUT') {
    const { id, content, category, tags, embedding: providedEmbedding } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      // Classification patch: category/tags/embedding provided directly (async classify result)
      if (!content && (category || providedEmbedding)) {
        const embeddingStr = providedEmbedding ? JSON.stringify(providedEmbedding) : null
        const row = await spanFn('postgres.update', { 'db.system': 'postgresql', 'db.operation': 'UPDATE' }, async () => {
          const [r] = await sql`
            UPDATE entries
            SET
              category = COALESCE(${category ?? null}, category),
              tags = COALESCE(${tags ?? null}, tags),
              embedding = COALESCE(${embeddingStr}::vector, embedding)
            WHERE id = ${id}
            RETURNING id, type, content, category, tags, created_at
          `
          return r
        })
        await flushSentry()
        return res.json(row)
      }

      // Content edit: re-embed from content
      if (!content) return res.status(400).json({ error: 'Missing content' })
      const embedding = await spanFn('openai.embed', { 'llm.model': 'text-embedding-3-small' }, async () => {
        const r = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: content }),
        })
        const data = await r.json()
        if (!r.ok) throw Object.assign(new Error('embed failed'), { body: data })
        return data.data[0].embedding
      })

      const embeddingStr = JSON.stringify(embedding)
      const row = await spanFn('postgres.update', { 'db.system': 'postgresql', 'db.operation': 'UPDATE' }, async () => {
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
      return res.status(500).json({ error: e.body ?? e.message })
    }
  }

  return res.status(405).end()
})
