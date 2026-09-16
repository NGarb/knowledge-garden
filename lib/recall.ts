// Pure helpers for Free Recall — the "describe a topic cold" practice mode.
// Framework-free and dependency-free (like flashcards.ts) so the pool-building
// and topic-drawing can be reasoned about and unit-tested in isolation. The API
// layer does all the I/O (corpus load, wikilink extraction) and feeds this
// module plain `RecallNote` records; nothing here touches GitHub or Next.
//
// A "topic" is one of:
//   - a CLUSTER: a curated group of notes (a MOC's members, or the notes under
//     a #framework/* tag) that you should be able to describe as a whole.
//   - a THESIS: a single aphoristic foundation note whose claim you defend.
//
// Selection is deliberately biased toward clusters (synthesis); a thesis is
// drawn only occasionally (a sharper depth rep).

// The minimal shape the pool builder needs from a note. The API maps each
// corpus doc into one of these (extracting wikilinks with lib/markdown there).
export interface RecallNote {
  name: string; // filename without .md — the wikilink target
  title: string; // display title (frontmatter.title ?? name)
  type: string; // frontmatter.type: "concept" | "fact" | "moc" | ...
  tags: string[]; // frontmatter.tags, verbatim (may include "#framework/x", "#moc")
  foundation: boolean;
  category: string;
  wikilinks: string[]; // [[targets]] found in the body (names, no brackets)
}

export type TopicKind = "cluster" | "thesis";

export interface TopicMember {
  name: string;
  title: string;
}

export interface Topic {
  kind: TopicKind;
  // Stable-ish key for anti-repeat and history (the normalized label).
  key: string;
  label: string; // what the user sees: "Economic Development Arc", etc.
  members: TopicMember[]; // for a thesis, the single note itself
  source: "moc" | "framework" | "thesis";
}

// A cluster needs at least this many members to be worth describing "broadly".
// Never surfaced to the user — purely an eligibility gate.
export const MIN_CLUSTER = 3;

// Concept/fact notes are the describable substance of a cluster; MOCs and
// project/build notes (anything else) are scaffolding and don't count as members.
const MEMBER_TYPES = new Set(["concept", "fact"]);

// --- label / key normalization ---------------------------------------------

export function normalizeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "State system MOC" → "State system". Strips a trailing/leading "MOC" token.
export function mocLabel(title: string): string {
  return title
    .replace(/\bMOC\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "#framework/network-power" → "Network power". Takes the segment after the
// last slash, turns dashes/underscores into spaces, sentence-cases it.
export function frameworkLabel(tag: string): string {
  const seg = tag.split("/").pop() ?? tag;
  const words = seg.replace(/^#/, "").replace(/[-_]+/g, " ").trim();
  if (!words) return tag;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isFrameworkTag(tag: string): boolean {
  return /^#?framework\//i.test(tag);
}

// A framework cluster is dropped when it substantially overlaps a MOC cluster
// (the same topic reached two ways — e.g. the "Development arc" tag vs the
// "Economic Development Arc" MOC). The MOC, being hand-authored, wins.
const OVERLAP_DROP = 0.6;

// A thesis is a claim you defend, not a definition you recite. Two title shapes
// betray a note that's really a concept/reference, not an aphorism:
//   - a trailing "(Author)" attribution: "Structural power (Susan Strange)"
//   - a filename-style slug that was never given a real title: "yen-carry-trade…"
function looksLikeThesis(title: string): boolean {
  if (/\([^)]*\)\s*$/.test(title)) return false; // trailing (attribution)
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(title)) return false; // slug-case
  return true;
}

// --- cluster building -------------------------------------------------------

// Resolve a list of wikilink targets to member notes, case-insensitively (the
// same resolution the Gaps view uses), keeping only concept/fact notes and
// de-duplicating by name.
function resolveMembers(
  targets: string[],
  byName: Map<string, RecallNote>
): TopicMember[] {
  const seen = new Set<string>();
  const members: TopicMember[] = [];
  for (const target of targets) {
    const note = byName.get(target.toLowerCase());
    if (!note) continue;
    if (!MEMBER_TYPES.has(note.type)) continue;
    if (seen.has(note.name)) continue;
    seen.add(note.name);
    members.push({ name: note.name, title: note.title });
  }
  return members;
}

// Build every eligible topic (clusters + theses) from a garden's notes.
// Ordering within a kind is deterministic (by label) so callers can rely on it;
// randomness lives entirely in drawTopic. Pass `gardenName` to drop the garden's
// root MOC (e.g. "World MOC"), which is a table of contents, not a topic.
export function buildTopicPool(notes: RecallNote[], gardenName = ""): Topic[] {
  const byName = new Map<string, RecallNote>();
  for (const n of notes) byName.set(n.name.toLowerCase(), n);

  const clusters = new Map<string, Topic>(); // keyed by normalizeKey(label)
  const memberSets = new Map<string, Set<string>>(); // key → member names, for overlap
  const rootKey = normalizeKey(gardenName);

  // MOC clusters take precedence: when a MOC and a framework tag describe the
  // same topic, we keep the MOC's (human-authored) label and membership.
  for (const n of notes) {
    if (n.type !== "moc") continue;
    const label = mocLabel(n.title);
    if (!label) continue;
    const key = normalizeKey(label);
    if (key === rootKey) continue; // the garden's root MOC is a ToC, not a topic
    const members = resolveMembers(n.wikilinks, byName);
    if (members.length < MIN_CLUSTER) continue;
    clusters.set(key, { kind: "cluster", key, label, members, source: "moc" });
    memberSets.set(key, new Set(members.map((m) => m.name)));
  }

  // Framework-tag clusters: group notes by each #framework/* tag.
  const byFramework = new Map<string, { label: string; members: TopicMember[] }>();
  for (const n of notes) {
    for (const tag of n.tags) {
      if (!isFrameworkTag(tag)) continue;
      const label = frameworkLabel(tag);
      const key = normalizeKey(label);
      const entry = byFramework.get(key) ?? { label, members: [] };
      // A framework cluster is about its concept/fact notes; skip MOCs/others.
      if (MEMBER_TYPES.has(n.type)) {
        entry.members.push({ name: n.name, title: n.title });
      }
      byFramework.set(key, entry);
    }
  }
  for (const [key, { label, members }] of byFramework) {
    if (clusters.has(key)) continue; // MOC already owns this exact topic
    if (members.length < MIN_CLUSTER) continue;
    // Drop it if it substantially overlaps an existing MOC cluster (same topic,
    // different label) — the MOC's richer, hand-authored version wins.
    const names = members.map((m) => m.name);
    let overlaps = false;
    for (const set of memberSets.values()) {
      const shared = names.filter((nm) => set.has(nm)).length;
      if (shared / names.length >= OVERLAP_DROP) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    clusters.set(key, { kind: "cluster", key, label, members, source: "framework" });
    memberSets.set(key, new Set(names));
  }

  // Thesis pool: aphoristic foundation concept notes — a claim to defend, not a
  // definition to recite. Exclude anything that is itself a cluster label, and
  // anything whose title reads as a reference/concept rather than a claim.
  const theses: Topic[] = [];
  for (const n of notes) {
    if (n.type !== "concept" || !n.foundation) continue;
    if (!looksLikeThesis(n.title)) continue;
    const key = normalizeKey(n.title);
    if (clusters.has(key)) continue;
    theses.push({
      kind: "thesis",
      key,
      label: n.title,
      members: [{ name: n.name, title: n.title }],
      source: "thesis",
    });
  }

  const clusterList = [...clusters.values()].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  theses.sort((a, b) => a.label.localeCompare(b.label));

  return [...clusterList, ...theses];
}

// --- drawing ----------------------------------------------------------------

export interface DrawOptions {
  // Topic keys to avoid re-serving (recent draws). Honored unless it would
  // leave nothing to draw, in which case it's relaxed.
  exclude?: string[];
  // Probability of drawing a thesis when both kinds are available. Default 0.22
  // (~1 in 4–5). Clusters are the intended default; theses are the depth rep.
  thesisChance?: number;
  // Injectable RNG for deterministic tests. Returns [0, 1).
  rng?: () => number;
}

// Pick one topic from a pool, biased toward clusters, avoiding recent repeats.
// Returns null only for an empty pool.
export function drawTopic(pool: Topic[], opts: DrawOptions = {}): Topic | null {
  if (pool.length === 0) return null;
  const rng = opts.rng ?? Math.random;
  const thesisChance = opts.thesisChance ?? 0.22;
  const exclude = new Set(opts.exclude ?? []);

  const clusters = pool.filter((t) => t.kind === "cluster");
  const theses = pool.filter((t) => t.kind === "thesis");

  // Decide which kind to draw, only offering a kind that has candidates.
  const wantThesis =
    theses.length > 0 && (clusters.length === 0 || rng() < thesisChance);
  const primary = wantThesis ? theses : clusters;
  const fallback = wantThesis ? clusters : theses;

  return (
    pickAvoiding(primary, exclude, rng) ??
    pickAvoiding(fallback, exclude, rng) ??
    // Everything was excluded — relax the exclusion rather than return nothing.
    pickAvoiding(pool, new Set(), rng)
  );
}

function pickAvoiding(
  topics: Topic[],
  exclude: Set<string>,
  rng: () => number
): Topic | null {
  const eligible = topics.filter((t) => !exclude.has(t.key));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(rng() * eligible.length)];
}
