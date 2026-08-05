# Build Documentation - Knowledge Garden + Obsidian Integration

## 📚 Quick Start

This folder contains everything needed to implement Knowledge Garden's integration with Obsidian.

### Read in This Order:
1. **DESIGN.md** - Architecture overview & high-level strategy
2. **SPECIFICATION.md** - Technical details, data models, API specs
3. **IMPLEMENTATION_PROMPT.md** - Detailed step-by-step implementation guide

---

## 📋 File Contents

| File | Purpose |
|------|---------|
| DESIGN.md | What, why, and how the system works at a high level |
| SPECIFICATION.md | Data models, file I/O specs, function signatures |
| IMPLEMENTATION_PROMPT.md | Handoff prompt for implementing engineer |

---

## 🚀 How to Use

**For implementing the feature:**
```
1. Copy IMPLEMENTATION_PROMPT.md content
2. Paste into Claude/AI model chat
3. Model implements Phase 1 & 2 from `/src/` and `/src/utils/`
```

**For understanding the design:**
```
1. Read DESIGN.md first (5 min)
2. Check SPECIFICATION.md for technical details (10 min)
3. Reference IMPLEMENTATION_PROMPT.md during coding
```

---

## 📍 Key Paths

- **Zettelkasten vault:** `/Users/nicollegarber/Documents/Notes/Zettelkasten/`
- **App source:** `/Users/nicollegarber/Documents/knowledge_garden/src/`
- **App data:** `/Users/nicollegarber/Documents/knowledge_garden/data/`

---

## ✅ Success Criteria

When complete, you should be able to:
- ✅ Capture entry in app → exports to Obsidian vault
- ✅ Read from Zettelkasten folders in app
- ✅ Calculate foundation coverage metrics
- ✅ Click foundation → see linked entries

See IMPLEMENTATION_PROMPT.md for detailed testing steps.

---

## 🔗 Current Data

- **Entries:** 87 (with embeddings)
- **Foundations:** 37 total
  - ai: 25
  - world: 10
  - culture: 2
- **Gardens:** ai, world, culture

See `/data/*.csv` for current state.
