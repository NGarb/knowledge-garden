# Knowledge Garden + Obsidian Integration Design

## Overview

Transform Knowledge Garden from a standalone app into a **capture + discovery layer** that integrates with Obsidian as the source of truth for connections and relationships.

**Core insight:** Quick capture in the app → rich linking + connection discovery in Obsidian → browse/discover via the app.

---

## Architecture

### Three-Part Workflow

```
1. CAPTURE (Garden App)
   Quick notes → export as markdown to Zettelkasten

2. ORGANIZE + CONNECT (Obsidian + obsidian-skills plugin)
   Refine notes → create links → plugin finds hidden connections

3. DISCOVER (Garden App)
   Read from Zettelkasten → query by garden/tags
   Show foundation coverage → explore from central nodes
```

### Three Knowledge Gardens

Each is a folder in Obsidian vault:

```
/Users/nicollegarber/Documents/Notes/Zettelkasten/
├── ai/                  # AI & machine learning concepts
├── world/               # Geopolitics, economics, systems
└── culture/             # Arts, society, creativity
```

---

## Data Flow

### New Entry Creation

**User action:** Click "Capture" in Garden app

**Process:**
1. User fills: `content`, `garden` (ai/world/culture), `tags` (optional), `type` (fact/insight/pattern/claim)
2. App generates: `id`, `created_at`, `embedding` (optional)
3. App exports markdown to `Zettelkasten/{garden}/` with metadata in YAML frontmatter
4. User refines in Obsidian, adds links to other notes

**Format example:**
```md
---
id: abc123
garden: ai
type: fact
tags: [embeddings, ml, optimization]
captured: 2026-08-02
foundation: false
embedding: [0.123, 0.456, ...]
---

Quick note captured in the app...

This relates to [[Model Context Protocol]] and [[Local LLMs]]
```

### Discovery from Obsidian

**Process:**
1. App periodically reads from `Zettelkasten/` folders
2. For each garden (ai/world/culture):
   - Parse frontmatter metadata
   - Count connections (wikilinks to each note)
   - Identify foundations (manually marked OR high-connectivity nodes)
   - Track coverage metrics

**Queries the app can answer:**
- "Show me all entries in the ai garden"
- "Show foundation coverage in world garden" (X of 10 foundations have 3+ entries linked)
- "Show central nodes (high-connection)"
- "Find entries related to [foundation]"
- "Semantic search across garden"

---

## Key Concepts

### Foundations (Syllabus)

**Definition:** Core concepts required to understand a garden. Think of it as a syllabus.

**Marking:** `foundation: true` in the YAML frontmatter

**Current state:**
- ai garden: 25 foundations
- world garden: 10 foundations
- culture garden: 2 foundations

**Metrics for a foundation:**
- How many entries link to it? (coverage)
- Is it actively connected or isolated?
- Last time it was referenced?

**Design question answered:** Foundations are **explicit + discovered**. You manually mark which notes are foundational, but the app discovers which ones are most connected (which also makes them important).

### Central Nodes (Emergent)

**Definition:** Nodes with unusually high connectivity compared to foundations.

**Discovery:** Will emerge from obsidian-skills analysis or by counting wikilink references.

**Purpose:** Signal to the user what's becoming a key concept worth exploring deeper.

---

## App Changes

### Remove
- ❌ Questions table (obsidian-skills replaces this)
- ❌ Questions UI component

### Keep
- ✅ Capture component (exports to Zettelkasten)
- ✅ Garden view (browse by garden)
- ✅ Discover component (semantic search)
- ✅ Foundation component (show coverage metrics)

### Add
- 📍 Read from local Zettelkasten filesystem
- 📍 Parse markdown + frontmatter
- 📍 Calculate foundation coverage
- 📍 Identify central nodes (via link count)
- 📍 "Explore from foundation" view

### Tech Details
- Capture: Still uses Neon + embeddings for on-the-go search
- Discovery: Read from filesystem + parse markdown
- No bidirectional sync (Obsidian is source of truth)

---

## Implementation Priority

**Phase 1:** Export + Filesystem Read
- Capture exports to correct folder
- Markdown formatting with frontmatter
- App can read from Zettelkasten folders

**Phase 2:** Discovery
- Parse frontmatter + wikilinks
- Calculate coverage metrics
- Show foundation completeness

**Phase 3:** Central Nodes + Obsidian Skills Integration
- Identify high-connectivity nodes
- Link to obsidian-skills output (if available)

---

## Success Metrics

1. You can capture → immediately see note in Obsidian
2. obsidian-skills finds connections automatically
3. App shows foundation coverage (e.g., "9 of 10 foundations have 3+ entries")
4. You can click a foundation → see all entries that link to it
5. Semantic search still works (drawing from Neon embeddings)
