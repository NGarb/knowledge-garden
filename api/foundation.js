import { neon } from '@neondatabase/serverless'

async function embedText(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  })
  const data = await res.json()
  return data.data[0].embedding
}

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS foundation_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      garden TEXT NOT NULL,
      concept TEXT NOT NULL,
      description TEXT,
      embedding VECTOR(1536),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  if (req.method === 'GET') {
    const garden = req.query.garden || 'ai'
    const nodes = await sql`
      SELECT id, concept, description, created_at FROM foundation_nodes
      WHERE garden = ${garden}
      ORDER BY created_at ASC
    `

    // For each node, check if any entries are semantically similar
    const entries = await sql`
      SELECT id, content, embedding FROM entries WHERE garden = ${garden}
    `

    const nodesWithCoverage = nodes.map(node => {
      // coverage determined by entry count attached to this node
      return { ...node, coverage: 'gap', entry_count: 0 }
    })

    if (entries.length > 0 && nodes.length > 0) {
      const nodeEmbeddings = await sql`
        SELECT id, embedding FROM foundation_nodes WHERE garden = ${garden}
      `
      const embMap = {}
      for (const n of nodeEmbeddings) {
        if (n.embedding) embMap[n.id] = JSON.parse(n.embedding)
      }

      for (const node of nodesWithCoverage) {
        if (!embMap[node.id]) continue
        const nodeVec = embMap[node.id]
        let count = 0
        for (const entry of entries) {
          if (!entry.embedding) continue
          const ev = typeof entry.embedding === 'string' ? JSON.parse(entry.embedding) : entry.embedding
          const dot = nodeVec.reduce((s, v, i) => s + v * ev[i], 0)
          const magA = Math.sqrt(nodeVec.reduce((s, v) => s + v * v, 0))
          const magB = Math.sqrt(ev.reduce((s, v) => s + v * v, 0))
          const sim = magA && magB ? dot / (magA * magB) : 0
          if (sim > 0.55) count++
        }
        node.entry_count = count
        node.coverage = count === 0 ? 'gap' : count < 3 ? 'shallow' : 'covered'
      }
    }

    return res.json(nodesWithCoverage)
  }

  if (req.method === 'POST') {
    const { garden, concept, description } = req.body
    if (!garden || !concept) return res.status(400).json({ error: 'garden and concept required' })
    const apiKey = process.env.OPENAI_API_KEY
    const text = description ? `${concept}: ${description}` : concept
    const embedding = await embedText(text, apiKey)
    const embeddingStr = JSON.stringify(embedding)
    const [row] = await sql`
      INSERT INTO foundation_nodes (garden, concept, description, embedding)
      VALUES (${garden}, ${concept}, ${description ?? null}, ${embeddingStr}::vector)
      RETURNING id, concept, description, created_at
    `
    return res.json({ ...row, coverage: 'gap', entry_count: 0 })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    await sql`DELETE FROM foundation_nodes WHERE id = ${id}::uuid`
    return res.json({ ok: true })
  }

  res.status(405).end()
}
