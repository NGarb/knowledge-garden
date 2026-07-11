import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, garden = 'ai', context_fetched = false, garden_context = null } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages required' })

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  let gardenContext = garden_context

  // Only fetch garden context on the first turn
  if (!context_fetched) {
    const firstUserMessage = messages[0]?.content || ''
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: firstUserMessage })
    })
    const embedData = await embedRes.json()

    if (embedRes.ok) {
      const embedding = embedData.data[0].embedding
      const sql = neon(process.env.DATABASE_URL)
      const embeddingStr = JSON.stringify(embedding)
      const entries = await sql`
        SELECT content, category, tags,
               1 - (embedding <-> ${embeddingStr}::vector) AS similarity
        FROM entries
        WHERE garden = ${garden}
          AND 1 - (embedding <-> ${embeddingStr}::vector) > 0.55
        ORDER BY embedding <-> ${embeddingStr}::vector
        LIMIT 5
      `
      if (entries.length > 0) {
        gardenContext = entries.map(e => `- ${e.content}`).join('\n')
      }
    }
  }

  const systemPrompt = `You are a thinking partner helping someone deepen their understanding of an idea through dialogue.

Your role:
- Reflect back what they're saying to check your understanding
- Ask one sharp question that exposes an assumption or gap
- Push gently on reasoning that is vague or circular
- Offer a reframe or counterexample when it would sharpen their thinking
- Never lecture. Keep responses short — 2-4 sentences max, then a question or a provocation
- When they've reached a genuine insight or articulated something clearly, name it: "that's the shift"

${gardenContext ? `Context from their knowledge garden (use this to connect ideas, not to answer for them):\n${gardenContext}` : ''}

You are not here to answer questions. You are here to help them think better.`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages
    })
  })

  const claudeData = await claudeRes.json()
  if (!claudeRes.ok) return res.status(500).json({ error: claudeData })

  return res.json({
    reply: claudeData.content[0].text,
    garden_context: gardenContext
  })
}
