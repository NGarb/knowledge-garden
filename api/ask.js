import { neon } from '@neondatabase/serverless'
import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'
import { trace } from '@opentelemetry/api'

initSentry()

export default withSpan('api.ask', async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { question, garden = 'ai' } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question required' })

  const span = trace.getActiveSpan()
  span?.setAttributes({
    'garden.name': garden,
    'question.length': question.length,
    'llm.model': 'claude-haiku-4-5',
  })

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  let embedding
  try {
    embedding = await spanFn('openai.embed', { 'llm.model': 'text-embedding-3-small' }, async () => {
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: question }),
      })
      const embedData = await embedRes.json()
      if (!embedRes.ok) throw Object.assign(new Error('embed failed'), { body: embedData })
      return embedData.data[0].embedding
    })
  } catch (e) {
    captureException(e)
    await flushSentry()
    return res.status(500).json({ error: e.body ?? e.message })
  }

  const sql = neon(process.env.DATABASE_URL)
  const embeddingStr = JSON.stringify(embedding)

  const [{ total, with_embeddings }, entries] = await spanFn(
    'postgres.hybrid_search',
    { 'db.system': 'postgresql', 'garden.name': garden },
    async (dbSpan) => {
      const [diag] = await sql`
        SELECT COUNT(*) AS total, COUNT(embedding) AS with_embeddings
        FROM entries WHERE garden = ${garden}
      `
      const rows = await sql`
        WITH vector_search AS (
          SELECT id, content, category, tags,
                 1 - (embedding <=> ${embeddingStr}::vector) AS similarity,
                 ROW_NUMBER() OVER (ORDER BY embedding <=> ${embeddingStr}::vector) AS rn
          FROM entries
          WHERE garden = ${garden}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${embeddingStr}::vector) > 0.3
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT 20
        ),
        fts_search AS (
          SELECT id, content, category, tags,
                 ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${question})) AS fts_score,
                 ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${question})) DESC) AS rn
          FROM entries
          WHERE garden = ${garden}
            AND to_tsvector('english', content) @@ plainto_tsquery('english', ${question})
          LIMIT 20
        ),
        rrf AS (
          SELECT
            COALESCE(v.id, f.id) AS id,
            COALESCE(v.content, f.content) AS content,
            COALESCE(v.category, f.category) AS category,
            COALESCE(v.tags, f.tags) AS tags,
            COALESCE(v.similarity, 0) AS similarity,
            COALESCE(1.0 / (60 + v.rn), 0) + COALESCE(1.0 / (60 + f.rn), 0) AS rrf_score
          FROM vector_search v
          FULL OUTER JOIN fts_search f ON v.id = f.id
        )
        SELECT id, content, category, tags, similarity, rrf_score
        FROM rrf
        ORDER BY rrf_score DESC
        LIMIT 8
      `
      dbSpan.setAttributes({
        'db.result_count': rows.length,
        'db.total_entries': Number(diag.total),
      })
      return [diag, rows]
    },
  )

  span?.setAttribute('db.entries_found', entries.length)

  if (entries.length === 0) {
    await flushSentry()
    return res.json({
      answer: "I don't know yet — your garden doesn't have anything on this topic. Keep capturing and it will grow.",
      sources: [],
      _debug: { total: Number(total), with_embeddings: Number(with_embeddings), garden },
    })
  }

  const context = entries.map((e, i) => `[${i + 1}] ${e.content}`).join('\n\n')

  let answer
  try {
    answer = await spanFn(
      'anthropic.messages',
      { 'llm.model': 'claude-haiku-4-5', 'llm.max_tokens': 1024 },
      async (llmSpan) => {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            system: `You are a thoughtful assistant helping someone explore their personal knowledge garden. Answer their question using only the entries provided. Cite entries by number like [1] or [2]. Be concise and direct. If the entries don't fully address the question, say so honestly.`,
            messages: [{ role: 'user', content: `Here are relevant entries from my knowledge garden:\n\n${context}\n\nQuestion: ${question}` }],
          }),
        })
        const claudeData = await claudeRes.json()
        if (!claudeRes.ok) throw Object.assign(new Error('anthropic failed'), { body: claudeData })
        llmSpan.setAttributes({
          'llm.input_tokens': claudeData.usage?.input_tokens ?? 0,
          'llm.output_tokens': claudeData.usage?.output_tokens ?? 0,
        })
        return claudeData.content[0].text
      },
    )
  } catch (e) {
    captureException(e)
    await flushSentry()
    return res.status(500).json({ error: e.body ?? e.message })
  }

  await flushSentry()
  return res.json({
    answer,
    sources: entries.map(e => ({
      id: e.id,
      content: e.content,
      category: e.category,
      tags: e.tags,
      similarity: e.similarity,
      rrf_score: e.rrf_score,
    })),
  })
})
