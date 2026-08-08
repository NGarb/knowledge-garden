# 06 — Capture

**What to build:** A floating capture button always visible in the app. Tapping it opens a capture sheet with a text area and a garden picker. On submit, full frontmatter is generated, the title is slugified to a filename, and the note is committed to the zettelkasten repo via the GitHub API. The capture view also opens (pre-filled) when the user taps a dead wikilink.

**Blocked by:** 02 — GitHub API layer (for write), 05 — note reading view (for dead wikilink trigger).

- [ ] Floating capture button visible on all screens (not occluding key content)
- [ ] Capture sheet: title input, body text area, garden picker (ai / world / culture / misc)
- [ ] Generate full frontmatter on submit: `id` (uuid v4), `garden`, `type: fact`, `category: Uncategorized`, `tags: []`, `captured` (ISO timestamp), `foundation: false`
- [ ] Slugify title to filename (`On Revolutions` → `on-revolutions.md`)
- [ ] Write file to correct garden folder in zettelkasten repo via GitHub API
- [ ] Pre-fill title when opened from a dead wikilink
- [ ] Show success confirmation, close sheet on commit
- [ ] Handle write errors gracefully
