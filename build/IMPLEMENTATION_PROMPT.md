# Implementation Prompt for Knowledge Garden + Obsidian Integration

## Context for New Model

You are implementing a feature to integrate a React/Vite web app (Knowledge Garden) with a local Obsidian vault. The user captures quick notes in the app, exports them as markdown files to their Obsidian vault, and then uses Obsidian (with obsidian-skills plugin) to discover connections.

**Key facts:**
- Vite + React frontend (at `/Users/nicollegarber/Documents/knowledge_garden/`)
- Three knowledge gardens: `ai`, `world`, `culture`
- Obsidian vault at: `/Users/nicollegarber/Documents/Notes/Zettelkasten/`
- Current data: 87 entries (CSV format) with embeddings + metadata
- Neon PostgreSQL for embeddings/semantic search (stays as is)
- No bidirectional sync (read-only after export)

---

## Documentation

**Read these files first (in this order):**

1. `DESIGN.md` - High-level overview + architecture
2. `SPECIFICATION.md` - Data models, file I/O specs, Phase breakdown
3. This prompt - Detailed implementation steps

**Current codebase:**
- `src/components/Capture.jsx` - Form for capturing new entries
- `src/components/Garden.jsx` - Browse entries by garden
- `src/components/Foundation.jsx` - Show foundations
- `src/utils/supabase.js` - Neon/Supabase integration
- `src/App.jsx` - Router + main layout

---

## Phase 1: Export Entries to Zettelkasten

### Goal
When user captures a new entry, export it as a markdown file to the Obsidian vault.

### Requirements

**1. Update Capture Component**
   - After form submission (currently saves to Neon), also call export function
   - Show success/error message
   - Optional: Display file path so user can open in Obsidian

**2. Create `src/utils/zettelkasten-export.js`**

   Export these functions:

   a) `generateYAMLFrontmatter(entry)`
   ```
   Input: Entry object with id, garden, type, tags, embedding, foundation, captured, category
   Output: YAML string formatted as:
   ---
   id: {id}
   garden: {garden}
   type: {type}
   category: {category}
   tags: [{tags as array}]
   captured: {ISO timestamp}
   foundation: {boolean}
   ---

   Note: embedding array should be stored as JSON string in frontmatter
   ```

   b) `exportEntryToZettelkasten(entry)`
   ```
   Input: Entry object (with all fields populated)
   Output: Promise<{ filePath: string, success: boolean, error?: string }>

   Steps:
   1. Create directory if not exists: {ZETTELKASTEN_PATH}/{garden}/
   2. Generate filename: {id}.md (or slug-based, keep it simple)
   3. Generate YAML frontmatter using generateYAMLFrontmatter()
   4. Format markdown body from entry.content (wrap in ```markdown``` if needed)
   5. Combine: frontmatter + body
   6. Write to file using fs/promises
   7. Return success with file path
   8. On error: return error message

   Env var: Read ZETTELKASTEN_PATH from environment (add to .env):
   ZETTELKASTEN_PATH=/Users/nicollegarber/Documents/Notes/Zettelkasten
   ```

   c) `slugifyTitle(title)` (helper)
   ```
   Convert "Model Context Protocol" → "model-context-protocol"
   Use for filename generation
   ```

**3. Handle File System Access**
   - Use `import fs from 'fs/promises'` (Node.js)
   - This requires backend API wrapper or Electron context
   - **CONSTRAINT:** Vite React frontend can't directly write to filesystem
   - **Solution:** Create API endpoint in Vite (dev time) or backend service
   - For now, assume availability (may need discussion on implementation)

**4. Update Capture.jsx**
   ```typescript
   // After successful Neon insert:
   const exportResult = await exportEntryToZettelkasten(newEntry);

   if (exportResult.success) {
     showMessage('✅ Captured to garden AND exported to Obsidian');
     console.log('File:', exportResult.filePath);
   } else {
     showMessage('⚠️ Saved to garden, but export failed: ' + exportResult.error);
   }
   ```

### Success Criteria
- ✅ Capture form still works
- ✅ Entry saves to Neon (existing behavior)
- ✅ Entry also exported as `.md` to Zettelkasten
- ✅ Markdown has proper YAML frontmatter
- ✅ File is readable in Obsidian
- ✅ User gets success/error feedback

### Testing
1. Manually capture an entry in the app
2. Check file was created: `ls /Users/nicollegarber/Documents/Notes/Zettelkasten/{garden}/`
3. Open in Obsidian → verify metadata + content
4. Add a wikilink in Obsidian: `[[Some Concept]]`
5. Save file

---

## Phase 2: Read from Zettelkasten + Calculate Coverage

### Goal
App reads exported markdown files from Obsidian vault and calculates foundation coverage metrics.

### Requirements

**1. Create `src/utils/zettelkasten-discovery.js`**

   Export these functions:

   a) `getZettelkastenPath()`
   ```
   Return ZETTELKASTEN_PATH from environment
   Throw error if not set
   ```

   b) `parseMarkdownEntry(filePath)`
   ```
   Input: full file path
   Output: Promise<Entry>

   Steps:
   1. Read file with fs/promises
   2. Extract YAML frontmatter (between --- delimiters)
   3. Parse YAML to object
   4. Extract markdown body (everything after second ---)
   5. Count wikilinks in body using regex: /\[\[([^\]]+)\]\]/g
   6. Return Entry object with metadata + wikilink counts

   Return object:
   {
     id: string,
     garden: string,
     type: string,
     tags: string[],
     content: string (markdown body),
     captured: string,
     foundation: boolean,
     wikilinks: string[] (names of linked notes)
   }
   ```

   c) `readEntriesByGarden(garden)`
   ```
   Input: "ai" | "world" | "culture"
   Output: Promise<Entry[]>

   Steps:
   1. Walk directory: {ZETTELKASTEN_PATH}/{garden}/
   2. Find all .md files
   3. For each .md file, call parseMarkdownEntry()
   4. Return array of all entries
   5. On error: log but continue (graceful)
   ```

   d) `listFoundationsInGarden(garden)`
   ```
   Input: garden string
   Output: Promise<Entry[]>

   Filter from readEntriesByGarden() where foundation === true
   ```

   e) `calculateFoundationCoverage(garden)`
   ```
   Input: garden string
   Output: Promise<{
     garden: string,
     totalFoundations: number,
     coveredFoundations: number,
     coveragePercent: number,
     foundations: {
       name: string,
       linkedCount: number,
       isCovered: boolean (linkedCount > 0)
     }[]
   }>

   Steps:
   1. Get all entries in garden via readEntriesByGarden()
   2. Get all foundations via listFoundationsInGarden()
   3. For each foundation, count how many entries link to it:
      - Search all entries' wikilinks for foundation name
      - Count matches
   4. Calculate coverage: (foundationsWithLinks / totalFoundations) * 100
   5. Build response object with metrics

   Example output:
   {
     garden: "ai",
     totalFoundations: 25,
     coveredFoundations: 18,
     coveragePercent: 72,
     foundations: [
       { name: "Multi-agent Systems", linkedCount: 7, isCovered: true },
       { name: "Model Context Protocol", linkedCount: 3, isCovered: true },
       { name: "Vector Databases", linkedCount: 0, isCovered: false }
     ]
   }
   ```

**2. Update Foundation.jsx Component**
   - Currently shows foundations from Neon
   - Add new section showing coverage metrics
   - Display: "18 of 25 foundations have linked entries (72%)"
   - Show list of foundations with coverage status
   - Optional: color-code (green = covered, red = empty)

**3. Add "Explore from Foundation" View**
   - When user clicks a foundation, show all entries that link to it
   - Query: all entries where wikilinks contains this foundation name

### Success Criteria
- ✅ Read markdown files from Zettelkasten
- ✅ Parse YAML frontmatter correctly
- ✅ Extract wikilinks from markdown body
- ✅ Calculate coverage metrics
- ✅ Foundation.jsx displays coverage
- ✅ Can click foundation → see linked entries

### Testing
1. Manually create test files in `Zettelkasten/ai/test/`:
   ```md
   ---
   id: test-foundation
   garden: ai
   type: fact
   foundation: true
   tags: [test]
   captured: 2026-08-02T12:00:00Z
   ---

   This is a test foundation.
   ```

2. Create entry that links to it:
   ```md
   ---
   id: test-entry
   garden: ai
   type: fact
   foundation: false
   tags: [test]
   captured: 2026-08-02T12:00:00Z
   ---

   This entry links to [[test-foundation]].
   ```

3. Call `calculateFoundationCoverage("ai")`
4. Verify it counts the linked entry correctly

---

## Implementation Order

**Start here:**

1. **Phase 1a:** Create `src/utils/zettelkasten-export.js` with `generateYAMLFrontmatter()` + `exportEntryToZettelkasten()`
2. **Phase 1b:** Update `Capture.jsx` to call export after form submission
3. **Test:** Manually capture entry, verify file created + readable in Obsidian
4. **Phase 2a:** Create `src/utils/zettelkasten-discovery.js` with all read/parse functions
5. **Phase 2b:** Update `Foundation.jsx` to show coverage metrics
6. **Test:** Create sample markdown files, verify discovery works
7. **Phase 2c:** Add "Explore from Foundation" feature

---

## Common Challenges

### File System Access in Vite
- React frontend can't use `fs` module directly
- **Solution**: Create backend API endpoint or use Electron
- **For now:** Assume Node.js context is available (backend service)

### Parsing YAML in JavaScript
- Use: `npm install js-yaml`
- Import: `import YAML from 'js-yaml'`
- Parse: `YAML.load(yamlString)`

### Working Directory
- Always use absolute paths: `/Users/nicollegarber/Documents/Notes/Zettelkasten/`
- Never assume relative paths

### Wikilink Regex
- Pattern: `/\[\[([^\]]+)\]\]/g`
- Captures: `[[Note Name]]` → `Note Name`
- Test: `const matches = body.match(/\[\[([^\]]+)\]\]/g)`

---

## Questions to Clarify Before Starting

1. **File System Access:** Should this be a backend API service or Vite dev-time function?
2. **Embeddings:** Should we re-compute embeddings when reading from Obsidian, or use stored ones?
3. **Filename Strategy:** Use UUID (`abc123.md`) or slugified title (`model-context-protocol.md`)?
4. **On Error:** If Obsidian file can't be read, fail the capture or show warning?

---

## Success = Complete Feature

User workflow:
1. Open Garden app → click "Capture"
2. Fill form: content, garden (ai/world/culture), tags
3. Click submit
4. See message: "✅ Saved to garden AND exported to Obsidian at [path]"
5. Switch to Obsidian → file is there with proper formatting
6. Refine in Obsidian → add links
7. Switch back to Garden app → Foundation.jsx shows "18 of 25 covered (72%)"
8. Click a foundation → see all entries that link to it
