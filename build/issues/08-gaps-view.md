# 08 — Gaps View

**What to build:** A view per garden that surfaces all wikilinks pointing to notes that don't exist yet. These are "gaps" — intentions named but not yet written. Tapping a gap opens the capture view pre-filled with that title, turning the gap into a note.

**Blocked by:** 05 — wikilink resolution logic from note reading view.

- [ ] Fetch all notes in a garden
- [ ] Extract all `[[wikilinks]]` from every note body
- [ ] Diff extracted links against the full set of existing filenames across all gardens
- [ ] Render list of unresolved links as gaps
- [ ] Show which note(s) reference each gap
- [ ] Tapping a gap opens capture pre-filled with that title
- [ ] Empty state: "No gaps — your wikilinks are all connected"
- [ ] Gaps accessible from the note list view of each garden
