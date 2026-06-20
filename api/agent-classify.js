import { streamText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
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

  // Embed the entry content upfront — needed when the user saves
  sse(res, { type: 'step', label: 'classifying…' })
  const entryEmbedding = await embedText(content, apiKey)

  let relatedEntries = []
  let connectedQuestions = []

  try {
    const result = streamText({
      model: openai('gpt-4o'),
      maxSteps: 6,
      system: `You are a knowledge classification agent for a personal knowledge garden.

Analyse the user's new entry and follow these steps:
1. Determine the category (one of: Insight, Discovery, Pattern, Connection, Idea, Question) and 3–6 lowercase tags
2. Call search_entries with a focused query that captures the core concept of the entry
3. Call search_questions with a query capturing what the entry answers or addresses
4. Based on what you found: identify any direct contradictions with existing entries (be specific, not vague), describe the knowledge gap this fills in one sentence, and suggest 1–2 focused follow-up questions

Output ONLY a valid JSON object — no markdown fences, no explanation — with exactly this structure:
{
  "category": "Insight",
  "tags": ["tag-one", "tag-two"],
  "contradictions": [],
  "gap": "A single sentence or null",
  "suggestedQuestions": ["Question one?"]
}`,
      messages: [{ role: 'user', content }],
      tools: {
        search_entries: tool({
          description: 'Search for semantically related existing entries in the knowledge garden',
          parameters: z.object({
            query: z.string().describe('A focused phrase or concept to search for')
          }),
          execute: async ({ query }) => {
            const embedding = await embedText(query, apiKey)
            const embeddingStr = JSON.stringify(embedding)
            const rows = await sql`
              SELECT id, content, category, tags, type,
                     1 - (embedding <-> ${embeddingStr}::vector) AS similarity
              FROM entries
              WHERE garden = ${garden}
                AND 1 - (embedding <-> ${embeddingStr}::vector) > 0.6
              ORDER BY embedding <-> ${embeddingStr}::vector
              LIMIT 5
            `
            relatedEntries = rows
            return rows.map(r => ({
              id: r.id,
              content: r.content,
              category: r.category,
              type: r.type,
              similarity: r.similarity
            }))
          }
        }),
        search_questions: tool({
          description: 'Search for open questions in the garden that this entry might address',
          parameters: z.object({
            query: z.string().describe('A phrase capturing what this entry answers or addresses')
          }),
          execute: async ({ query }) => {
            const embedding = await embedText(query, apiKey)
            const embeddingStr = JSON.stringify(embedding)
            const rows = await sql`
              SELECT id, text, entry_id,
                     1 - (embedding <-> ${embeddingStr}::vector) AS similarity
              FROM questions
              WHERE closed_at IS NULL
                AND garden = ${garden}
                AND 1 - (embedding <-> ${embeddingStr}::vector) > 0.55
              ORDER BY embedding <-> ${embeddingStr}::vector
              LIMIT 5
            `
            connectedQuestions = rows
            return rows.map(r => ({ id: r.id, text: r.text, similarity: r.similarity }))
          }
        })
      }
    })

    let fullText = ''

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        fullText += part.textDelta
      } else if (part.type === 'tool-call') {
        const label = part.toolName === 'search_entries'
          ? 'searching knowledge base…'
          : 'searching open questions…'
        sse(res, { type: 'step', label })
      } else if (part.type === 'finish') {
        let parsed = {}
        try {
          const match = fullText.match(/\{[\s\S]*\}/)
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
      }
    }
  } catch (e) {
    sse(res, { type: 'error', message: e.message })
  }

  res.end()
}
