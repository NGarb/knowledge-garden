import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { withSpan, spanFn } from './_otel.js'
import { initSentry, captureException, flushSentry } from './_sentry.js'

initSentry()

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

/**
 * Slugify title for filename
 */
function slugifyTitle(title) {
  if (!title) return 'note'
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
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

    // Generate filename (use id as base)
    const filename = `${id}.md`
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
