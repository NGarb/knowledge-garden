import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { parseMarkdownEntry } from '../src/utils/zettelkasten-discovery.js'

/**
 * Read all markdown files from a garden directory
 */
async function readEntriesByGarden(garden, zettelkastenPath) {
  const gardenDir = join(zettelkastenPath, garden)
  const entries = []

  try {
    const files = await readdir(gardenDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    for (const file of mdFiles) {
      try {
        const filePath = join(gardenDir, file)
        const content = await readFile(filePath, 'utf-8')
        const entry = parseMarkdownEntry(content)
        entries.push(entry)
      } catch (err) {
        console.error(`Error parsing ${file}:`, err.message)
      }
    }
  } catch (err) {
    console.error(`Error reading garden directory ${garden}:`, err.message)
    throw err
  }

  return entries
}

/**
 * Get only foundation entries from a garden
 */
async function listFoundationsInGarden(garden, zettelkastenPath) {
  const entries = await readEntriesByGarden(garden, zettelkastenPath)
  return entries.filter(e => e.foundation === true)
}

/**
 * Calculate foundation coverage metrics for a garden
 */
async function calculateFoundationCoverage(garden, zettelkastenPath) {
  const allEntries = await readEntriesByGarden(garden, zettelkastenPath)
  const foundations = allEntries.filter(e => e.foundation === true)

  // For each foundation, count how many entries link to it
  const foundationsWithCoverage = foundations.map(foundation => {
    const foundationName = foundation.category || foundation.id // Use category as readable name

    // Count entries (excluding the foundation itself) that have wikilinks to this foundation
    const linkedCount = allEntries.filter(entry => {
      // Don't count the foundation entry itself
      if (entry.id === foundation.id) return false

      // Check if entry's wikilinks reference this foundation
      return entry.wikilinks.some(link =>
        link === foundationName ||
        link === foundation.id ||
        link.toLowerCase() === foundationName.toLowerCase()
      )
    }).length

    return {
      id: foundation.id,
      name: foundationName,
      linkedCount,
      isCovered: linkedCount > 0
    }
  })

  const totalFoundations = foundations.length
  const coveredFoundations = foundationsWithCoverage.filter(f => f.isCovered).length
  const coveragePercent = totalFoundations > 0
    ? Math.round((coveredFoundations / totalFoundations) * 100)
    : 0

  return {
    garden,
    totalFoundations,
    coveredFoundations,
    coveragePercent,
    foundations: foundationsWithCoverage
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { garden, action } = req.body

  if (!action) {
    return res.status(400).json({ error: 'Missing required field: action' })
  }

  if (!garden) {
    return res.status(400).json({ error: 'Missing required field: garden' })
  }

  const zettelkastenPath = process.env.ZETTELKASTEN_PATH
  if (!zettelkastenPath) {
    return res.status(500).json({ error: 'ZETTELKASTEN_PATH not configured' })
  }

  try {
    let result

    switch (action) {
      case 'entries':
        result = await readEntriesByGarden(garden, zettelkastenPath)
        break
      case 'foundations':
        result = await listFoundationsInGarden(garden, zettelkastenPath)
        break
      case 'coverage':
        result = await calculateFoundationCoverage(garden, zettelkastenPath)
        break
      case 'export': {
        const { id, type, category, tags, embedding, foundation, captured, content } = req.body
        if (!id || !content) return res.status(400).json({ error: 'Missing required fields: id, content' })
        const gardenDir = join(zettelkastenPath, garden)
        await mkdir(gardenDir, { recursive: true })
        const slug = content.split('\n')[0].replace(/^["']|["']$/g, '').substring(0, 50).toLowerCase()
          .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'note'
        const filename = `${slug}--${id.substring(0, 8)}.md`
        const tagsStr = tags?.length ? `[${tags.map(t => `"${t}"`).join(', ')}]` : '[]'
        const frontmatter = `---\nid: ${id}\ngarden: ${garden}\ntype: ${type}\ncategory: ${category || 'Uncategorized'}\ntags: ${tagsStr}\ncaptured: ${captured}\nfoundation: ${foundation === true ? 'true' : 'false'}\nembedding: ${JSON.stringify(embedding ?? [])}\n---\n`
        await writeFile(join(gardenDir, filename), frontmatter + content.trim() + '\n', 'utf-8')
        result = { success: true, filePath: join(gardenDir, filename), id, garden, filename }
        break
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    return res.json(result)
  } catch (error) {
    console.error('zettelkasten-discovery error:', error)
    return res.status(500).json({ error: error.message })
  }
}
