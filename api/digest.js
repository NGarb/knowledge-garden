function extractYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?#]+)/)
  return m ? m[1] : null
}

async function getYouTubeTranscript(videoId) {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  const html = await pageRes.text()

  const titleMatch = html.match(/<title>(.+?) - YouTube<\/title>/)
  const title = titleMatch ? titleMatch[1] : 'YouTube video'

  const captionMatch = html.match(/"captionTracks":(\[.*?\])/)
  if (!captionMatch) return { title, text: null }

  let tracks
  try { tracks = JSON.parse(captionMatch[1]) } catch { return { title, text: null } }

  const track =
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => t.languageCode?.startsWith('en')) ||
    tracks[0]
  if (!track?.baseUrl) return { title, text: null }

  const transcriptRes = await fetch(track.baseUrl)
  const xml = await transcriptRes.text()

  const text = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map(m =>
      m[1]
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<[^>]*>/g, '')
    )
    .join(' ')

  return { title, text }
}

async function fetchArticleText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  })
  const html = await res.text()

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title = titleMatch
    ? titleMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/ [-|].*$/, '').trim()
    : url

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { title, text }
}

async function extractAndRespond(res, key, title, text, sourceType, garden) {
  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Extract 6-10 specific, substantive knowledge seeds from this content. Each must be self-contained — understandable without the source. Avoid vague meta-commentary. Write each as a clear factual statement or first-person insight.

For each seed:
- "content": the specific insight or fact in 1-3 sentences
- "category": one of Insight, Discovery, Pattern, Connection, Idea, Question
- "tags": array of 3-5 lowercase tags

Return JSON with key "entries" containing the array.

Source: "${title}"

Content:
${text.slice(0, 10000)}`
      }],
      response_format: { type: 'json_object' }
    })
  })

  const chatData = await chatRes.json()
  if (!chatRes.ok) return res.status(500).json({ error: chatData })

  let candidates = []
  try {
    const parsed = JSON.parse(chatData.choices[0].message.content)
    candidates = Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return res.status(500).json({ error: 'Failed to parse extraction result' })
  }

  if (candidates.length === 0) return res.status(422).json({ error: 'No seeds could be extracted' })

  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: candidates.map(c => c.content)
    })
  })
  const embedData = await embedRes.json()
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  const embeddings = embedData.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding)

  const enriched = candidates.map((c, i) => ({ ...c, embedding: embeddings[i] }))
  return res.json({ title, type: sourceType, candidates: enriched })
}

async function extractPaperLeaf(res, key, title, text) {
  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `You are reading an academic paper. Extract a structured leaf — a single, comprehensive knowledge record of this paper.

Be specific and concrete. Include numbers, percentages, and model/dataset names wherever the paper provides them. Avoid vague summaries.

Return a JSON object with these exact keys:

- "claim": The paper's central thesis or contribution in 1-2 sentences. What does it argue or prove?
- "central_concepts": Array of objects, each with "term" and "definition" (1 sentence). Cover the 3-6 key concepts a reader needs to understand this paper.
- "method": What is novel about the approach? How did they do it? 2-4 sentences.
- "findings": Array of strings. Each is a specific empirical result — include numbers, metrics, effect sizes. 2-6 findings.
- "benchmarks": Array of objects, each with "dataset", "metric", "score", and optionally "baseline" and "baseline_score". Leave as empty array if no benchmarks reported.
- "limitations": Array of strings. Gaps or caveats the paper itself acknowledges. 2-4 items.
- "implications": What does this mean for the field or adjacent fields? 2-3 sentences.
- "practical_application": What might this mean for practitioners or clients in industry? Be concrete — name potential use cases, workflows, or tools this could improve. 2-4 sentences. (This field will be editable by the user.)
- "open_questions": Array of strings. What does this leave unresolved or open for future work? 2-4 items.
- "tags": Array of 4-6 lowercase tags for this paper.
- "authors": Author names as a single string, if identifiable from the text.
- "year": Publication year as a string, if identifiable.
- "venue": Journal or conference name, if identifiable.

Paper title: "${title}"

Paper content:
${text.slice(0, 14000)}`
      }],
      response_format: { type: 'json_object' }
    })
  })

  const chatData = await chatRes.json()
  if (!chatRes.ok) return res.status(500).json({ error: chatData })

  let leaf
  try {
    leaf = JSON.parse(chatData.choices[0].message.content)
  } catch {
    return res.status(500).json({ error: 'Failed to parse paper leaf' })
  }

  // Build a prose string for embedding from all substantive fields
  const embeddingText = [
    leaf.claim,
    (leaf.central_concepts || []).map(c => `${c.term}: ${c.definition}`).join(' '),
    leaf.method,
    (leaf.findings || []).join(' '),
    leaf.implications,
    leaf.practical_application,
    (leaf.open_questions || []).join(' ')
  ].filter(Boolean).join(' ')

  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: embeddingText })
  })
  const embedData = await embedRes.json()
  if (!embedRes.ok) return res.status(500).json({ error: embedData })

  const embedding = embedData.data[0].embedding
  return res.json({ title, type: 'paper', leaf: { ...leaf, embedding } })
}

const PASTE_HINT_HOSTS = ['open.spotify.com', 'podcasts.apple.com', 'overcast.fm', 'pocketcasts.com', 'castro.fm']

function isPasteOnlyUrl(url) {
  try {
    const host = new URL(url).hostname
    return PASTE_HINT_HOSTS.some(h => host.includes(h))
  } catch { return false }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { url, text: pastedText, title: pastedTitle, garden = 'ai' } = req.body
  const key = process.env.OPENAI_API_KEY

  // Paste mode — text provided directly, skip fetching
  if (pastedText) {
    if (pastedText.trim().length < 50) {
      return res.status(400).json({ error: 'Pasted text is too short to extract knowledge from.' })
    }
    return await extractAndRespond(res, key, pastedTitle || 'Pasted content', pastedText.trim(), 'paste', garden)
  }

  if (!url) return res.status(400).json({ error: 'url or text required' })

  // Podcast apps can't be scraped — tell the user to use paste mode
  if (isPasteOnlyUrl(url)) {
    return res.status(422).json({
      error: 'Podcast app links can\'t be fetched directly. Use paste mode — copy the transcript or show notes and paste them in.',
      hint: 'paste'
    })
  }

  let title = url
  let text = null
  let sourceType = 'article'

  try {
    const videoId = extractYouTubeId(url)
    if (videoId) {
      sourceType = 'youtube'
      const result = await getYouTubeTranscript(videoId)
      title = result.title
      text = result.text
    } else {
      const result = await fetchArticleText(url)
      title = result.title
      text = result.text
      if (url.includes('arxiv.org')) sourceType = 'paper'
      else if (url.includes('github.com')) sourceType = 'github'
    }
  } catch (e) {
    return res.status(422).json({ error: `Could not fetch content: ${e.message}` })
  }

  if (!text || text.length < 50) {
    return res.status(422).json({
      error: 'Not enough content found at this URL.',
      hint: 'paste'
    })
  }

  if (sourceType === 'paper') {
    return await extractPaperLeaf(res, key, title, text)
  }

  return await extractAndRespond(res, key, title, text, sourceType, garden)
}
