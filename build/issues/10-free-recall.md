# 10 — Free Recall

**What to build:** A per-garden practice mode that suggests a *topic* you should be able to
describe well, lets you brain-dump everything you know cold (no notes visible), then reveals the
topic's notes as a self-grading checklist. Missed notes can be sent to the review deck in one tap,
and every attempt is logged. Built for the `world` garden first; the route works for any garden.

The exercise is **free recall** (blank-page / Feynman): retrieval builds the connected, explain-it-out-loud
mastery that atomic flashcards structurally can't test. The review deck trains *maintenance*; this trains
*synthesis and diagnosis*.

**Blocked by:** 05 (wikilink resolution), and the flashcards/review stack (`lib/flashcards.ts`, `/api/review`).

## Design decisions (locked)

- **Value is retrieval-first.** The writing is the point; grading stays lightweight (checklist + free text),
  no LLM grading of the dump.
- **Topic unit = curated clusters.** Draw from MOCs (`type: moc`) and `#framework/*` tags — the topics the
  user already hand-grouped. Not loose tags, not raw `category` buckets like "Case Study".
- **Mostly clusters, occasionally a thesis.** ~1 draw in 4–5 serves a single aphoristic `foundation` concept
  note ("Events happen, structures matter") to *defend*, for a depth rep.
- **No counts shown.** Cluster size is a *hidden* eligibility gate (>= 3 members), never displayed.
- **Persistence = the git content repo.** Attempts log to `recall/<garden>.json`, outside the garden
  folders, so `loadCorpus` never sees them (no pollution of search / mastery / gaps). Survives devices and
  seeds future scheduling.
- **Cards live in note bodies.** "Gaps → cards" appends a `front :: back` line to the missed note and writes
  it back — no separate store. Back-text is prefilled (note title :: first line), editable, no LLM.

## Data model

`recall/<garden>.json` — append-only array of:

```ts
interface RecallAttempt {
  id: string;
  topic: string;
  kind: "cluster" | "thesis";
  at: string;                 // ISO timestamp
  dump: string;               // everything written cold
  covered: string[];          // note names
  missed: string[];
  shaky: string[];
  freeGaps: string;           // "what I couldn't explain", in my own words
  feel?: 1 | 2 | 3 | 4 | 5;   // optional; seeds future scheduling
}
```

## Pieces

- [x] `lib/recall.ts` — **pure, dependency-free** (like `flashcards.ts`). Given `RecallNote[]`
      (`{ name, title, type, tags, foundation, category, wikilinks }`), builds the eligible topic pool:
  - [x] MOC clusters: resolve a MOC note's wikilinks to member notes (case-insensitive), keep `concept|fact` members
  - [x] Framework-tag clusters: group notes by each `#framework/*` tag; derive a label from the tag
  - [x] Dedupe MOC vs framework clusters by member overlap; prefer the MOC label (label-similarity left off by choice — "Development arc" and "Economic Development Arc" kept distinct)
  - [x] Eligibility gate: `members.length >= MIN_CLUSTER` (hidden)
  - [x] Thesis pool: `type: concept && foundation`, excluding cluster labels + the garden root MOC + reference-style titles
  - [x] `drawTopic(pool, { exclude, thesisChance })` — random pick with anti-repeat + occasional thesis
- [x] `lib/recall.test.ts` — `node:test`, run with `node --test lib/recall.test.ts` (Node 24, zero deps) — 16 tests
- [x] `GET /api/recall/topic?garden=&exclude=` → `{ kind, label, members: [{name,title}] }`
- [x] `GET /api/recall/log?garden=&topic=` → attempt history
- [x] `POST /api/recall/attempt` → append to `recall/<garden>.json`
- [x] Card write (`/api/recall/card`): GET a prefilled draft (title :: first line), POST appends `front :: back` to the note
- [x] `app/garden/[garden]/recall/page.tsx` + `RecallSession.tsx` (full-screen: draw → dump → reveal/grade → save)
- [x] "Recall" link in the garden header, beside Mastery / Gaps
- [x] Reveal checklist: tap a note title to cycle covered / shaky / missed; "what I couldn't explain" box; optional 1–5 feel
- [x] "Turn gaps into cards": per-gap confirm (prefilled front :: back, editable) → append to note
- [x] History: past-attempt summary shown under a freshly drawn topic

_Not yet run: a live end-to-end smoke test (the app is password-gated)._

## Deferred (not this issue)

- Dump → new note (editorial / garden-pollution questions to settle first)
- Spaced scheduling of topics (the log is the seed; drawing stays on-demand + anti-repeat)
- LLM grading of the dump

## Build order

1. `lib/recall.ts` + `lib/recall.test.ts` (pure, no I/O)
2. `GET /api/recall/topic` + draw/dump UI — a usable loop
3. Reveal + grade + `POST /attempt` + `recall/<garden>.json` — self-grade & log complete
4. Gaps → cards
5. History panel
