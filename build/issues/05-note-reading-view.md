# 05 — Note Reading View

**What to build:** The core reading experience. A note's body is rendered as markdown. Frontmatter is collapsed by default and expandable. Wikilinks are tappable — resolving to an existing note navigates there, dead wikilinks open the capture view pre-filled with the linked title. Navigation: back button retraces steps, home button jumps to garden cards.

**Blocked by:** 04 — note list must exist.

- [ ] Fetch and render note body as markdown
- [ ] Frontmatter panel: collapsed by default, expands on tap, shows tags / type / garden / captured date
- [ ] Detect all `[[wikilinks]]` in rendered body
- [ ] Resolve wikilinks against the set of existing filenames in the vault
- [ ] Tapping a live wikilink navigates to that note (push onto nav stack)
- [ ] Tapping a dead wikilink opens capture view pre-filled with that title
- [ ] Back button: pop nav stack, return to previous note
- [ ] Home button: clear nav stack, return to garden home
- [ ] Foundation marker visible on reading view
