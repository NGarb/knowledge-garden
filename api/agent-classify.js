import { neon } from '@neondatabase/serverless'

export const config = { maxDuration: 60 }

async function embedText(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  })
  const data = await res.json()
  return data.data[0].embedding
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { content, garden = 'ai' } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  const sql = neon(process.env.DATABASE_URL)
  const apiKey = process.env.OPENAI_API_KEY

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  sse(res, { type: 'step', label: 'classifying…' })
  const entryEmbedding = await embedText(content, apiKey)

  // Search entries
  sse(res, { type: 'step', label: 'searching knowledge base…' })
  const entryEmbeddingStr = JSON.stringify(entryEmbedding)
  const relatedEntries = await sql`
    SELECT id, content, category, tags, type,
           1 - (embedding <-> ${entryEmbeddingStr}::vector) AS similarity
    FROM entries
    WHERE garden = ${garden}
      AND 1 - (embedding <-> ${entryEmbeddingStr}::vector) > 0.6
    ORDER BY embedding <-> ${entryEmbeddingStr}::vector
    LIMIT 5
  `

  // Search questions
  sse(res, { type: 'step', label: 'searching open questions…' })
  const connectedQuestions = await sql`
    SELECT id, text, entry_id,
           1 - (embedding <-> ${entryEmbeddingStr}::vector) AS similarity
    FROM questions
    WHERE closed_at IS NULL
      AND garden = ${garden}
      AND 1 - (embedding <-> ${entryEmbeddingStr}::vector) > 0.55
    ORDER BY embedding <-> ${entryEmbeddingStr}::vector
    LIMIT 5
  `

  // Classify with OpenAI directly
  const contextBlock = relatedEntries.length
    ? `Related entries:\n${relatedEntries.map(r => `- ${r.content} (similarity: ${r.similarity?.toFixed(2)})`).join('\n')}`
    : 'No related entries found.'

  const questionsBlock = connectedQuestions.length
    ? `Open questions this might address:\n${connectedQuestions.map(q => `- ${q.text}`).join('\n')}`
    : 'No related open questions found.'

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a knowledge classification agent for a personal knowledge garden.

${contextBlock}

${questionsBlock}

Analyse the user's entry and output ONLY a valid JSON object — no markdown fences, no explanation — with exactly this structure:
{
  "category": "Insight",
  "tags": ["tag-one", "tag-two"],
  "contradictions": [],
  "gap": "A single sentence or null",
  "suggestedQuestions": ["Question one?"]
}

Category must be one of: Insight, Discovery, Pattern, Connection, Idea, Question
Tags: 3-6 lowercase tags
Contradictions: specific contradictions with the related entries above, or empty array
Gap: one sentence describing what knowledge gap this fills, or null
suggestedQuestions: 1-2 focused follow-up questions`
          },
          { role: 'user', content }
        ],
        temperature: 0.3
      })
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || '{}'

    let parsed = {}
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch (_) {}

    sse(res, {
      type: 'result',
      data: {
        category: parsed.category || 'Insight',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        embedding: entryEmbedding,
        contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
        gap: parsed.gap || null,
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
        relatedEntries,
        connectedQuestions
      }
    })
  } catch (e) {
    sse(res, { type: 'error', message: e.message })
  }

  res.end()
}