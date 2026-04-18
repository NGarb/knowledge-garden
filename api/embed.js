export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })

  const key = process.env.OPENAI_API_KEY

  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  })

  const data = await r.json()
  if (!r.ok) return res.status(500).json({ error: data })

  res.json({ embedding: data.data[0].embedding })
}
