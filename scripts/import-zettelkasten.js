#!/usr/bin/env node

/**
 * Convert CSV data to Zettelkasten markdown files
 * Run this once to populate the Obsidian vault with existing entries
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const ZETTELKASTEN_PATH = '/Users/nicollegarber/Documents/Notes/Zettelkasten'
const DATA_DIR = '/Users/nicollegarber/Documents/knowledge_garden/data'

/**
 * Robust CSV parser that handles quoted fields with newlines
 */
function parseCSVRobust(csvText) {
  const rows = []
  let headers = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false
  let isFirstLine = true

  let i = 0
  while (i < csvText.length) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"'
        i += 2
        continue
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
        i++
        continue
      }
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
      i++
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim())
      }

      if (currentRow.length > 0 && currentRow.some(f => f)) {
        if (isFirstLine) {
          headers = currentRow
          isFirstLine = false
        } else {
          const obj = {}
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentRow[j] || ''
          }
          rows.push(obj)
        }
      }

      currentRow = []
      currentField = ''
      // Skip \r\n
      if (char === '\r' && nextChar === '\n') i++
      i++
      continue
    }

    currentField += char
    i++
  }

  // Handle last field
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
  }

  if (currentRow.length > 0 && currentRow.some(f => f) && !isFirstLine) {
    const obj = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentRow[j] || ''
    }
    rows.push(obj)
  }

  return rows
}

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

function generateYAMLFrontmatter(entry, isFoundation = false) {
  const { id, garden, type, category, tags, created_at } = entry

  const tagsStr = tags ? tags : '[]'

  return `---
id: ${id}
garden: ${garden}
type: ${type}
category: ${category || 'Uncategorized'}
tags: ${tagsStr}
captured: ${created_at}
foundation: ${isFoundation ? 'true' : 'false'}
---
`
}

async function importEntries() {
  try {
    console.log('📂 Reading CSV data...')

    // Read foundation_nodes.csv first to get the IDs of foundations
    const foundationRaw = readFileSync(join(DATA_DIR, 'foundation_nodes.csv'), 'utf-8')
    const foundations = parseCSVRobust(foundationRaw)
    const foundationIds = new Set(foundations.map(f => f.id))

    console.log(`✓ Loaded ${foundations.length} foundations`)

    // Read entries.csv - this has ALL entries
    const entriesRaw = readFileSync(join(DATA_DIR, 'entries.csv'), 'utf-8')
    const entries = parseCSVRobust(entriesRaw)

    console.log(`✓ Loaded ${entries.length} total entries`)

    // Create garden directories
    const gardens = ['ai', 'world', 'culture']
    for (const garden of gardens) {
      mkdirSync(join(ZETTELKASTEN_PATH, garden), { recursive: true })
    }

    console.log('✓ Created garden directories')

    // Write markdown files
    let written = 0
    let errors = 0

    for (const entry of entries) {
      try {
        if (!entry.id || !entry.garden || !entry.content) {
          errors++
          continue
        }

        const isFoundation = foundationIds.has(entry.id)
        const frontmatter = generateYAMLFrontmatter(entry, isFoundation)
        const content = entry.content || '(empty)'
        const fullContent = frontmatter + content.trim() + '\n'

        // Generate readable filename from content + UUID suffix
        const slug = slugifyContent(entry.content)
        const shortId = entry.id.substring(0, 8)
        const filename = `${slug}--${shortId}.md`
        const filepath = join(ZETTELKASTEN_PATH, entry.garden, filename)
        writeFileSync(filepath, fullContent, 'utf-8')
        written++

        if (written % 10 === 0) {
          process.stdout.write('.')
        }
      } catch (e) {
        errors++
      }
    }

    console.log(`\n\n✅ Imported ${written} of ${entries.length} entries to Zettelkasten`)
    if (errors > 0) {
      console.log(`⚠️  ${errors} entries skipped`)
    }

    // Summary by garden
    const byGarden = entries.reduce((acc, e) => {
      if (e.garden) acc[e.garden] = (acc[e.garden] || 0) + 1
      return acc
    }, {})

    const foundationsByGarden = foundations.reduce((acc, f) => {
      if (f.garden) acc[f.garden] = (acc[f.garden] || 0) + 1
      return acc
    }, {})

    console.log('\n📊 Distribution:')
    for (const [garden, count] of Object.entries(byGarden).sort()) {
      const foundationCount = foundationsByGarden[garden] || 0
      console.log(`  ${garden}: ${count} entries, ${foundationCount} marked as foundations`)
    }

  } catch (e) {
    console.error('❌ Import failed:', e.message)
    process.exit(1)
  }
}

importEntries()


