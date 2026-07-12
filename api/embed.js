import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'

initSentry()

export default withSpan('api.embed', async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })

  let embedding
  try {
    embedding = await spanFn('openai.embed', { 'llm.model': 'text-embedding-3-small' }, async () => {
      const r = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      })
      const data = await r.json()
      if (!r.ok) throw Object.assign(new Error('embed failed'), { body: data })
      return data.data[0].embedding
    })
  } catch (e) {
    captureException(e)
    await flushSentry()
    return res.status(500).json({ error: e.body ?? e.message })
  }

  await flushSentry()
  return res.json({ embedding })
})
