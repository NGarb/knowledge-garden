export const config = { maxDuration: 60 }

const GARDEN_PROMPTS = {
  ai: `You are helping build the foundation layer of a personal knowledge garden for an A-tier forward-deployed AI engineer.

Generate exactly 12 foundational concepts that form the load-bearing skeleton of this field. These should be:
- The things you MUST understand before anything else makes sense
- Durable (won't be obsolete in 6 months)
- Mechanistic (how things actually work, not just what they are)

Focus on: transformer architecture internals, training dynamics, evaluation theory, alignment fundamentals, agent architectures, inference economics, prompt engineering principles, retrieval systems, fine-tuning vs prompting tradeoffs, context and memory, tool use patterns, deployment and latency.`,

  world: `You are helping build the foundation layer of a personal knowledge garden modeled on "the best possible curriculum for the president of the United States" — a decision-relevant, interconnected understanding of geopolitics, systems, economics, history, and geography.

Generate exactly 12 foundational concepts that form the load-bearing skeleton of this worldview. These should be:
- Frameworks that make other facts legible (not facts themselves)
- Durable across decades
- Decision-relevant: they change how you act under uncertainty

Focus on: how geography shapes state behavior, the logic of power and deterrence, how trade creates interdependence and leverage, how institutions form and decay, the dynamics of empire rise and fall, economic incentives vs political logic, how information shapes conflict, demographic pressures, the structure of international order, ideology vs interest, historical case studies as anchors.`,

  culture: `You are helping build the foundation layer of a personal culture knowledge garden — no prescribed shape, whatever form it takes.

Generate exactly 10 foundational concepts or lenses that help a curious person make sense of culture, art, and human expression across time and place. These should be generous and open-ended rather than prescriptive.`
}

async function chat(messages, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o', messages, temperature: 0.3 })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { garden } = req.body
  if (!garden) return res.status(400).json({ error: 'garden required' })

  const apiKey = process.env.OPENAI_API_KEY
  const systemPrompt = GARDEN_PROMPTS[garden] || GARDEN_PROMPTS.ai

  const raw = await chat([
    {
      role: 'system',
      content: `${systemPrompt}

Respond ONLY with a valid JSON array, no markdown fences:
[
  { "concept": "Short name (3-5 words)", "description": "One sentence: what this is and why it's foundational." },
  ...
]`
    },
    { role: 'user', content: `Generate the foundation for the ${garden} garden.` }
  ], apiKey)

  let nodes = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) nodes = JSON.parse(match[0])
  } catch (_) {}

  return res.json({ nodes })
}
