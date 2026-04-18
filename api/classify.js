export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { content } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  const key = process.env.OPENAI_API_KEY

  const [chatRes, embedRes] = await Promise.all([
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Classify this knowledge entry. Respond with JSON only.\n\nKeys:\n- "category": one of Insight, Discovery, Pattern, Connection, Idea, Question\n- "tags": array of 3–6 lowercase tags (single words or hyphenated)\n\nEntry:\n${content}`
        }],
        response_format: { type: 'json_object' }
      })
    }),
    fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: content })
    })
  ])

  const chatData = await chatRes.json()
  const embedData = await embedRes.json()

  if (!chatRes.ok) return res.status(500).json({ error: chatData })
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  const { category, tags } = JSON.parse(chatData.choices[0].message.content)
  const embedding = embedData.data[0].embedding

  res.json({ category, tags, embedding })
}
