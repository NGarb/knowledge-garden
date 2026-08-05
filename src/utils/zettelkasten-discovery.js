/**
 * Zettelkasten Discovery Utilities
 * Parse markdown entries and calculate foundation coverage
 */

/**
 * Simple YAML parser for frontmatter
 */
export function parseYAML(yamlStr) {
  const obj = {}
  yamlStr.split('\n').forEach(line => {
    if (!line.trim()) return
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return

    const key = line.substring(0, colonIdx).trim()
    const value = line.substring(colonIdx + 1).trim()

    if (!key) return

    // Handle arrays: tags: ["item1", "item2"]
    if (value.startsWith('[')) {
      try {
        obj[key] = JSON.parse(value)
      } catch {
        obj[key] = value
      }
    } else if (value === 'true') {
      obj[key] = true
    } else if (value === 'false') {
      obj[key] = false
    } else {
      obj[key] = value
    }
  })
  return obj
}

/**
 * Extract YAML frontmatter and markdown body from content
 */
export function splitFrontmatterAndBody(content) {
  const lines = content.split('\n')
  if (!lines[0].trim().startsWith('---')) {
    return { frontmatter: {}, body: content }
  }

  let secondDashIdx = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('---')) {
      secondDashIdx = i
      break
    }
  }

  if (secondDashIdx === -1) {
    return { frontmatter: {}, body: content }
  }

  const yamlStr = lines.slice(1, secondDashIdx).join('\n')
  const body = lines.slice(secondDashIdx + 1).join('\n')

  return {
    frontmatter: parseYAML(yamlStr),
    body
  }
}

/**
 * Extract wikilinks from markdown body
 */
export function extractWikilinks(markdownBody) {
  const matches = markdownBody.match(/\[\[([^\]]+)\]\]/g) || []
  return matches.map(m => m.slice(2, -2)) // Remove [[ and ]]
}

/**
 * Parse a markdown entry file content
 */
export function parseMarkdownEntry(content) {
  const { frontmatter, body } = splitFrontmatterAndBody(content)
  const wikilinks = extractWikilinks(body)

  return {
    id: frontmatter.id,
    garden: frontmatter.garden,
    type: frontmatter.type,
    category: frontmatter.category,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    content: body.trim(),
    captured: frontmatter.captured,
    foundation: frontmatter.foundation === true || frontmatter.foundation === 'true',
    wikilinks
  }
}

/**
 * Call backend API to discover entries by garden
 */
export async function readEntriesByGarden(garden) {
  const res = await fetch('/api/zettelkasten-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garden, action: 'entries' })
  })

  if (!res.ok) {
    throw new Error(`Failed to read entries: ${res.statusText}`)
  }

  return res.json()
}

/**
 * Call backend API to get foundation entries only
 */
export async function listFoundationsInGarden(garden) {
  const res = await fetch('/api/zettelkasten-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garden, action: 'foundations' })
  })

  if (!res.ok) {
    throw new Error(`Failed to list foundations: ${res.statusText}`)
  }

  return res.json()
}

/**
 * Call backend API to calculate foundation coverage
 */
export async function calculateFoundationCoverage(garden) {
  const res = await fetch('/api/zettelkasten-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garden, action: 'coverage' })
  })

  if (!res.ok) {
    throw new Error(`Failed to calculate coverage: ${res.statusText}`)
  }

  return res.json()
}
