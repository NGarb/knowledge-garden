import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'

initSentry()

/**
 * Generate filename-safe slug from content
 */
function slugifyContent(content) {
  if (!content) return 'note'

  // Take first line, remove quotes, take first 50 chars
  const firstLine = content.split('\n')[0]
    .replace(/^["']|["']$/g, '')
    .substring(0, 50)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return firstLine || 'note'
}

/**
 * Convert entry object to YAML frontmatter string
 */
function generateYAMLFrontmatter(entry) {
  const { id, garden, type, category, tags, embedding, foundation, captured } = entry

  const embeddingStr = embedding ? JSON.stringify(embedding) : '[]'
  const tagsStr = tags && tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(', ')}]` : '[]'

  return `---
id: ${id}
garden: ${garden}
type: ${type}
category: ${category || 'Uncategorized'}
tags: ${tagsStr}
captured: ${captured}
foundation: ${foundation === true ? 'true' : 'false'}
embedding: ${embeddingStr}
---
`
}

export default withSpan('api.export-zettelkasten', async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id, garden, type, category, tags, embedding, foundation, captured, content } = req.body

  if (!id || !garden || !content) {
    return res.status(400).json({ error: 'Missing required fields: id, garden, content' })
  }

  const span = req.span
  span?.setAttributes({ 'garden.name': garden, 'entry.type': type })

  try {
    const zettelkastenPath = process.env.ZETTELKASTEN_PATH
    if (!zettelkastenPath) {
      throw new Error('ZETTELKASTEN_PATH not configured')
    }

    // Create garden directory if it doesn't exist
    const gardenDir = join(zettelkastenPath, garden)
    await spanFn('fs.mkdir', { 'fs.operation': 'mkdir' }, async () => {
      await mkdir(gardenDir, { recursive: true })
    })

    // Generate readable filename from content + UUID suffix
    const slug = slugifyContent(content)
    const shortId = id.substring(0, 8)
    const filename = `${slug}--${shortId}.md`
    const filepath = join(gardenDir, filename)

    // Generate YAML frontmatter
    const frontmatter = generateYAMLFrontmatter({
      id,
      garden,
      type,
      category,
      tags,
      embedding,
      foundation: foundation === true,
      captured
    })

    // Combine frontmatter + content
    const fullContent = frontmatter + content.trim() + '\n'

    // Write file
    await spanFn('fs.writeFile', { 'fs.operation': 'writeFile' }, async () => {
      await writeFile(filepath, fullContent, 'utf-8')
    })

    await flushSentry()
    return res.json({
      success: true,
      filePath: filepath,
      id,
      garden,
      filename
    })
  } catch (e) {
    console.error('export-zettelkasten error:', e)
    captureException(e)
    await flushSentry()
    return res.status(500).json({
      success: false,
      error: e.message
    })
  }
})
