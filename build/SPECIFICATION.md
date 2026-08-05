# Technical Specification

## Data Model

### Entry Object

When captured in the app:
```json
{
  "id": "uuid",
  "garden": "ai|world|culture",
  "type": "fact|insight|pattern|claim|discovery",
  "category": "Insight|Pattern|Claim|Discovery",
  "content": "string (markdown or plain text)",
  "tags": ["tag1", "tag2"],
  "embedding": [0.123, 0.456, ...],
  "captured": "2026-08-02T15:30:00Z",
  "foundation": false
}
```

### Markdown Export Format

Filename: `{garden}/{title-slug}.md` or `{garden}/{id}.md`

Example: `/Users/nicollegarber/Documents/Notes/Zettelkasten/ai/model-context-protocol.md`

```yaml
---
id: abc-123-def
garden: ai
type: fact
category: Insight
tags: [embeddings, ml, optimization]
captured: 2026-08-02T15:30:00Z
foundation: false
---

**Your note content here**

Refinements made in Obsidian...

Related: [[Model Context Protocol]], [[Local LLMs]]
```

### Foundation Node (Marked in Obsidian)

Same as above, but:
```yaml
foundation: true
```

Example: `/Users/nicollegarber/Documents/Notes/Zettelkasten/ai/multi-agent-systems.md`

---

## File I/O Operations

### Writing (Capture → Zettelkasten)

**Function signature:**
```typescript
exportEntryToZettelkasten(entry: Entry): Promise<{
  filePath: string,
  success: boolean
}>
```

**Logic:**
1. Create markdown filename (slug from title or use id)
2. Convert embeddings array to JSON string (store in frontmatter)
3. Write YAML frontmatter + markdown body to file
4. Return filepath for confirmation

**Path:** `/Users/nicollegarber/Documents/Notes/Zettelkasten/{garden}/{id}.md`

### Reading (Obsidian → App)

**Function signatures:**
```typescript
readZettelkastenByGarden(garden: "ai"|"world"|"culture"): Promise<Entry[]>
listFoundationsInGarden(garden: string): Promise<Entry[]>
parseMarkdownFile(filePath: string): Promise<Entry>
countWikilinks(filePath: string): Promise<{ [noteName: string]: number }>
```

**Logic:**
1. Walk directory: `/Users/nicollegarber/Documents/Notes/Zettelkasten/{garden}/`
2. For each `.md` file:
   - Parse YAML frontmatter (extract metadata)
   - Count wikilinks in body: `[[Link Name]]` regex → `/\[\[([^\]]+)\]\]/g`
   - Parse embeddings array from frontmatter
3. Return array of Entry objects

---

## Current Data State

```
entries.csv:       88 rows (+ header)
foundation_nodes.csv: 37 rows
  - ai: 25
  - world: 10
  - culture: 2

Garden distribution (from foundation_nodes):
  - ai: 25 concepts
  - world: 10 concepts
  - culture: 2 concepts
```

**Sample foundation in ai garden:**
```
Title: Model Context Protocol (MCP)
Tags: [ai integration, protocol, data connectivity, standardization]
Content: "The Model Context Protocol standardizes the way AI applications
          connect to external tools and data sources..."
```

---

## Phase 1: Export Functions

### Feature: Capture → Export to Zettelkasten

**Location:** `src/components/Capture.jsx` + new `src/utils/zettelkasten-export.js`

**Required:**
1. When user submits capture form:
   - Collect: content, garden, tags, type, category
   - Generate: id (uuid), embedding (call embedding API), captured (timestamp)
   - Call: `exportEntryToZettelkasten(entry)`
2. Show success/error message
3. Optional: show file path for user to open in Obsidian

**New file: `src/utils/zettelkasten-export.js`**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Export entry to Zettelkasten markdown file
 * Creates: /Users/nicollegarber/Documents/Notes/Zettelkasten/{garden}/{id}.md
 */
async function exportEntryToZettelkasten(entry) {
  // Implementation here
}

/**
 * Convert entry object to YAML frontmatter string
 */
function generateYAMLFrontmatter(entry) {
  // Implementation here
}

export { exportEntryToZettelkasten, generateYAMLFrontmatter };
```

---

## Phase 2: Discovery Functions

### Feature: Read from Zettelkasten + Calculate Coverage

**Location:** New `src/utils/zettelkasten-discovery.js`

```typescript
/**
 * Read all entries from a specific garden
 */
async function readEntriesByGarden(garden) {
  // Walk Zettelkasten/{garden}/ directory
}

/**
 * Parse markdown file with YAML frontmatter
 */
async function parseMarkdownEntry(filePath) {
  // Extract frontmatter + wikilinks
}

/**
 * Count wikilinks for each note
 */
function countWikilinks(markdownBody) {
  // Return { "Note Name": count }
}

/**
 * Calculate foundation coverage metrics
 */
async function calculateFoundationCoverage(garden) {
  // Returns: {
  //   total: 25,
  //   covered: 18,
  //   coverage: "72%",
  //   foundations: [
  //     { name, linkedEntries: 5, coverage: "full" },
  //     { name, linkedEntries: 0, coverage: "empty" }
  //   ]
  // }
}

export { readEntriesByGarden, parseMarkdownEntry, calculateFoundationCoverage };
```

**UI Changes:**
- Foundation component now shows coverage metrics
- New "Explore from Foundation" feature
- Click foundation → see all linked entries

---

## Environment Variables

Add to `.env`:
```
ZETTELKASTEN_PATH=/Users/nicollegarber/Documents/Notes/Zettelkasten
```

Ensure this is accessible from both:
- Node.js backend (reads/writes files)
- React frontend (displays)

---

## Constraints

1. **No Neon writes** during Phase 1-2 (Obsidian is source of truth)
2. **Embeddings** still stored in Neon for semantic search (on-the-go)
3. **Markdown as system of record** (Obsidian is the primary storage)
4. **Node.js file access** required (may need Electron or backend service)

---

## Testing Data

Generate test files in `/Users/nicollegarber/Documents/Notes/Zettelkasten/test/`:

```md
---
id: test-001
garden: ai
type: fact
category: Insight
tags: [test, embedding]
captured: 2026-08-02T12:00:00Z
foundation: false
---

This is a test entry for the Zettelkasten integration.

It links to [[Test Foundation]] and [[Another Concept]].
```

Then test:
- Read file → parse correctly
- Count wikilinks correctly
- Calculate coverage with samples
