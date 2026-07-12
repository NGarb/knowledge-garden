import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'

initSentry()

export default withSpan('api.classify', async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { content } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  const key = process.env.OPENAI_API_KEY

  let category, tags, embedding
  try {
    [{ category, tags }, embedding] = await Promise.all([
      spanFn('openai.chat', { 'llm.model': 'gpt-4o-mini' }, async () => {
        const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Classify this knowledge entry. Respond with JSON only.\n\nKeys:\n- "category": one of Insight, Discovery, Pattern, Connection, Idea, Question\n- "tags": array of 3–6 lowercase tags (single words or hyphenated)\n\nEntry:\n${content}`,
            }],
            response_format: { type: 'json_object' },
          }),
        })
        const data = await chatRes.json()
        if (!chatRes.ok) throw Object.assign(new Error('openai chat failed'), { body: data })
        return JSON.parse(data.choices[0].message.content)
      }),
      spanFn('openai.embed', { 'llm.model': 'text-embedding-3-small' }, async () => {
        const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: content }),
        })
        const data = await embedRes.json()
        if (!embedRes.ok) throw Object.assign(new Error('openai embed failed'), { body: data })
        return data.data[0].embedding
      }),
    ])
  } catch (e) {
    captureException(e)
    await flushSentry()
    return res.status(500).json({ error: e.body ?? e.message })
  }

  await flushSentry()
  return res.json({ category, tags, embedding })
})
