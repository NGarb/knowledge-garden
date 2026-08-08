# 04 — Note List View

**What to build:** The list of notes within a garden. Each note shows its title and first line of body content as a preview. Foundation notes are visually marked with a small indicator. Tapping a note navigates to the note reading view.

**Blocked by:** 03 — garden home must exist.

- [ ] Fetch all `.md` files for the selected garden via GitHub API layer
- [ ] Parse frontmatter to extract `title` (or derive from filename), `foundation`
- [ ] Extract first line of body content as preview text
- [ ] Render list with title + preview per note
- [ ] Show small foundation marker (dot or pill) on notes where `foundation: true`
- [ ] Tapping a note navigates to note reading view
- [ ] Loading and empty states handled
