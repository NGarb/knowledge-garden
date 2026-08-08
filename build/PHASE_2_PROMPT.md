# Phase 2: Zettelkasten Discovery & Foundation Coverage

## Project Overview

**Knowledge Garden** is a React/Vite web app that captures quick notes about three domains:
- `ai` - AI & machine learning concepts (25 foundations)
- `world` - Geopolitics, economics, systems (10 foundations)
- `culture` - Arts, society, creativity (2 foundations)

The workflow is: **Capture → Obsidian (edit/link) → Discover (coverage metrics)**

## Phase 1 Status: ✅ COMPLETE

**What's done:**
- Users capture entries in app → auto-exports to Zettelkasten markdown
- Files stored at: `/Users/nicollegarber/Documents/Notes/Zettelkasten/{garden}/{slug}--{uuid}.md`
- Each file has YAML frontmatter with: id, garden, type, category, tags, foundation flag, captured timestamp
- 37 foundation entries already imported + ready in Zettelkasten

## Phase 2: Read from Zettelkasten & Calculate Coverage

### Goal
App reads markdown files from Obsidian vault and calculates **foundation coverage metrics**. Specifically: how many foundations have entries linked to them via wikilinks?

Example output:
```
Garden: ai
Total foundations: 25
Covered foundations: 18 (72%)
Foundations: [
  { name: "Model Context Protocol", linkedCount: 7, isCovered: true },
  { name: "Vector Databases", linkedCount: 0, isCovered: false }
]
```

### Architecture Decision: Simple One-Way Read

**Sync Strategy:** No tracking. Just read fresh files every time.
- When discovering coverage → read latest Zettelkasten files
- Extract wikilinks from markdown body (regex: `/\[\[([^\]]+)\]\]/g`)
- Check frontmatter for updated metadata (tags, foundation flag)
- Return whatever the current state is

If user edited in Obsidian → next discovery run sees the changes automatically.

---

## Implementation: Create Two Files

### 1. `src/utils/zettelkasten-discovery.js` (Client utility)

Export these functions:

#### `parseMarkdownEntry(filePath: string): Promise<Entry>`
- Read markdown file
- Extract YAML frontmatter (between `---` delimiters)
- Parse YAML to object
- Extract markdown body (everything after second `---`)
- Count wikilinks in body using regex: `/\[\[([^\]]+)\]\]/g`
- Return Entry object with metadata + wikilinks array

Return format:
```javascript
{
  id: string,
  garden: string,
  type: string,
  category: string,
  tags: string[],
  content: string,
  captured: string,
  foundation: boolean,
  wikilinks: string[]  // Names of linked notes, e.g., ["Model Context Protocol", "Vector DB"]
}
```

#### `readEntriesByGarden(garden: string): Promise<Entry[]>`
- Walk directory: `/Users/nicollegarber/Documents/Notes/Zettelkasten/{garden}/`
- Find all `.md` files
- For each, call `parseMarkdownEntry()`
- Return array of all entries

#### `listFoundationsInGarden(garden: string): Promise<Entry[]>`
- Call `readEntriesByGarden(garden)`
- Filter where `foundation === true`

#### `calculateFoundationCoverage(garden: string): Promise<CoverageMetrics>`
- Get all entries: `readEntriesByGarden(garden)`
- Get all foundations: `listFoundationsInGarden(garden)`
- For each foundation:
  - Search all entries' wikilinks for foundation name
  - Count how many times it's linked (linkedCount)
  - Mark as covered if linkedCount > 0
- Calculate coverage: `(coveredCount / totalCount) * 100`

Return format:
```javascript
{
  garden: string,
  totalFoundations: number,
  coveredFoundations: number,
  coveragePercent: number,
  foundations: [
    {
      id: string,
      name: string (extracted from foundation entry),
      linkedCount: number,
      isCovered: boolean (linkedCount > 0)
    }
  ]
}
```

### 2. `api/zettelkasten-discovery.js` (Vercel API endpoint)

Create POST endpoint at `/api/zettelkasten-discovery`

**Request body:**
```json
{
  "garden": "ai|world|culture",
  "action": "coverage" | "entries" | "foundations"
}
```

**Responses:**

- `action: "coverage"` → Return `calculateFoundationCoverage()` result
- `action: "entries"` → Return `readEntriesByGarden()` result
- `action: "foundations"` → Return `listFoundationsInGarden()` result

Error handling: Return 400 if garden is missing; 500 if file read fails.

---

## Key Implementation Details

### Parsing YAML Frontmatter

Use: `npm list js-yaml` to check if available. If not, use simple regex:

```javascript
function parseYAML(yamlStr) {
  const obj = {}
  yamlStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':')
    if (!key) return
    const value = valueParts.join(':').trim()

    // Handle arrays: tags: ["item1", "item2"]
    if (value.startsWith('[')) {
      obj[key.trim()] = JSON.parse(value)
    } else {
      obj[key.trim()] = value
    }
  })
  return obj
}
```

### Extracting Wikilinks

```javascript
function extractWikilinks(markdownBody) {
  const matches = markdownBody.match(/\[\[([^\]]+)\]\]/g) || []
  return matches.map(m => m.slice(2, -2)) // Remove [[ and ]]
}
```

### File Reading

Use Node.js `fs/promises`:
```javascript
import { readFile } from 'fs/promises'
const content = await readFile(filePath, 'utf-8')
```

---

## Integration Points

### Foundation.jsx Component

Currently shows static foundation list. Update to:
1. Call `/api/zettelkasten-discovery?garden={garden}&action=coverage`
2. Display: "18 of 25 foundations have linked entries (72%)"
3. Show list of foundations with coverage status:
   - ✅ Green if covered (linkedCount > 0)
   - ❌ Red if empty (linkedCount === 0)
4. On click foundation → show all entries that link to it

### New "Explore from Foundation" Feature

When user clicks a foundation:
1. Call `/api/zettelkasten-discovery?garden={garden}&action=entries`
2. Filter entries where `wikilinks.includes(foundationName)`
3. Display entries that link to that foundation
4. Show wikilink count + content preview

---

## Testing Checklist

✅ Environment setup:
- ZETTELKASTEN_PATH already in `.env.local`: `/Users/nicollegarber/Documents/Notes/Zettelkasten`
- 37 foundation entries already at `/Users/nicollegarber/Documents/Notes/Zettelkasten/{ai,world,culture}/*.md`

Test queries:
1. `parseMarkdownEntry()` → read one file, extract metadata + wikilinks
2. `readEntriesByGarden('ai')` → should return 25 entries
3. `calculateFoundationCoverage('ai')` → should return metrics with 25 foundations
4. Try editing a markdown file, add wikilinks → re-read should show new links

---

## Existing Code to Reference

- `api/export-zettelkasten.js` - Shows how to generate YAML frontmatter
- `src/utils/zettelkasten-export.js` - Shows how to call backend API from React
- `src/components/Foundation.jsx` - Current foundation display (needs update)
- `src/components/Garden.jsx` - How to browse entries

---

## Success Criteria

✅ Can read all markdown files from Zettelkasten
✅ Parse YAML frontmatter correctly
✅ Extract wikilinks from markdown bodies
✅ Calculate coverage: X of Y foundations have links
✅ Foundation component displays coverage metrics
✅ Can click foundation → see all entries linking to it
✅ All 3 gardens work (ai, world, culture)

---

## Files to Create/Modify

- **Create:** `src/utils/zettelkasten-discovery.js` (client utility)
- **Create:** `api/zettelkasten-discovery.js` (Vercel endpoint)
- **Modify:** `src/components/Foundation.jsx` (display coverage + click handler)
- **Modify:** `package.json` (if adding js-yaml dependency)

---

## Notes

- Obsidian is source of truth (read-only after export)
- Simple approach: always read fresh files, no tracking/syncing
- Foundation name matching: exact string match in wikilinks
- Works with current markdown format: `{slug}--{uuid}.md`
