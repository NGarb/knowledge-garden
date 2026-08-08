# Garden App — Spec

## Problem Statement

The existing knowledge garden app is built around a capture-first flow that forces notes into a form-based shape. It doesn't support browsing or navigating between notes, and the architecture (Supabase, embeddings, Neon DB) adds complexity without value. There is no good mobile companion for the Zettelkasten.

## Solution

A mobile-first PWA that treats the Obsidian Zettelkasten as the single source of truth. The app reads and writes markdown files directly via the GitHub API — no database, no sync issues. Obsidian and the app are two views of the same files. The core interactions are: browse your gardens, follow wikilinks from note to note, and capture new thoughts.

## User Stories

1. As a user, I want to see my 4 gardens (ai, world, culture, misc) as cards on the home screen, so I can orient quickly when I open the app.
2. As a user, I want to tap a garden and see a list of its notes, so I can find what I'm looking for.
3. As a user, I want each note in the list to show its title and first line of content, so I can identify the right note without opening it.
4. As a user, I want foundation notes to have a small visual marker in the list, so I can distinguish anchors from exploratory notes at a glance.
5. As a user, I want to tap a note and read it in a clean mobile view, so I can focus on the content.
6. As a user, I want frontmatter (tags, type, garden, date) to be collapsed by default and expandable, so the reading experience is clean but metadata is accessible.
7. As a user, I want wikilinks in a note to be tappable and navigate to the linked note, so I can follow threads naturally.
8. As a user, I want tapping a dead wikilink (no matching note) to open the capture view pre-filled with that title, so gaps become invitations to write.
9. As a user, I want a back button to retrace my steps note by note, so I can navigate carefully through a thread.
10. As a user, I want a home tap to jump back to the garden cards in one go, so I can reset when I've gone deep.
11. As a user, I want a floating capture button always visible, so I can capture a thought without interrupting what I'm reading.
12. As a user, I want the capture view to show a text box and a garden picker, so I can write my thought and place it in the right garden quickly.
13. As a user, I want capture to auto-generate full frontmatter (id, garden, type, category, tags, captured, foundation: false), so every note is properly formed from the start.
14. As a user, I want captured notes to use a slugified title as the filename, so files are readable in Obsidian.
15. As a user, I want captured notes committed directly to the zettelkasten repo via GitHub API, so there is no intermediate sync step.
16. As a user, I want a global search that scans all gardens simultaneously, so I can find notes regardless of which garden they're in.
17. As a user, I want search results grouped by garden, so I can understand the context of each result.
18. As a user, I want a Gaps view per garden showing all wikilinks that point to notes that don't exist yet, so I can see what threads I've named but not written.
19. As a user, I want tapping a gap to open the capture view pre-filled with that title, so I can close gaps intentionally.
20. As a user, I want the app to be password protected, so my garden is private even though the URL is public.
21. As a user, I want to be able to install the app to my iPhone home screen as a PWA, so it feels native and is one tap away.

## Implementation Decisions

- **Stack**: Next.js App Router, Tailwind CSS, deployed to Vercel
- **Data layer**: GitHub API only — `GET /repos/NGarb/zettelkasten/contents/{path}` to read, `PUT` to write. No database.
- **Auth**: Single `SITE_PASSWORD` env var checked in Next.js middleware on every request. Session stored in a cookie.
- **Env vars**: `GITHUB_PAT`, `GITHUB_REPO=NGarb/zettelkasten`, `SITE_PASSWORD`
- **Markdown rendering**: Parse frontmatter (YAML between `---`) separately from body. Render body as markdown. Detect `[[wikilinks]]` and convert to tappable nav links.
- **Wikilink resolution**: Match link text against filenames (slugified title → filename lookup). Dead if no match found.
- **Frontmatter generation on capture**: `id` (uuid v4), `garden` (user-selected), `type: fact`, `category: Uncategorized`, `tags: []`, `captured` (ISO timestamp), `foundation: false`
- **Filename on capture**: slugify the title (`On Revolutions` → `on-revolutions.md`)
- **Foundation marker**: small dot or pill indicator on notes where `foundation: true` in frontmatter
- **Gaps detection**: fetch all files per garden, extract all `[[wikilink]]` occurrences from all note bodies, diff against the set of existing filenames
- **Search**: fetch all notes from all gardens on search, filter client-side by title and body content, group results by garden
- **No AI in v1**
- **No multi-user / garden subscriptions in v1** — personal app, one GitHub repo

## Testing Decisions

- Test behaviour at the GitHub API boundary — mock the GitHub API responses, not the internal file parsing logic
- Test wikilink resolution and dead link detection with a fixture set of markdown files
- Test frontmatter generation for capture — assert all required fields are present and well-formed
- Test slugification — title → filename edge cases (special characters, dashes, unicode)
- Test password middleware — unauthenticated requests redirect, authenticated requests pass through

## Out of Scope (v1)

- AI / Claude integration
- Garden subscriptions / sharing with others
- Per-user accounts or multi-tenancy
- Offline support beyond PWA shell
- Note editing in the app (create only, edit in Obsidian)
- Backlinks (which notes link to this one)

## Further Notes

- The Zettelkasten repo lives at `NGarb/zettelkasten`. Gardens map to top-level folders: `ai/`, `world/`, `culture/`, `misc/`.
- The existing `knowledge_garden` repo and Vercel project will be reused — old code wiped, new Next.js app scaffolded in its place.
- Obsidian remains the primary authoring environment. The app is a companion for browsing and quick capture on mobile.
