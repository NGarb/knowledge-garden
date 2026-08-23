// Pure helpers for flashcards that live *inside* a note body, mirroring how
// tasks.ts treats GFM checklists: cards are a markdown convention, their review
// schedule rides along in a trailing HTML comment, and everything round-trips
// with Obsidian untouched. Framework-free so the parsing + scheduling can be
// reasoned about (and unit-tested) in isolation.
//
// Supported card syntax (single-line, Obsidian Spaced-Repetition compatible):
//   Basic:  front :: back
//   Cloze:  The capital of France is {{Paris}}   (also ==Paris==)
//
// Scheduling state is appended as an HTML comment the markdown renderer and
// Obsidian both ignore:
//   front :: back <!-- sr due=2026-08-25 ease=2.50 reps=3 int=6 -->
// A card with no such comment is "new" and due immediately.

export type CardKind = "basic" | "cloze";

export interface SrsState {
  due: string; // YYYY-MM-DD (local)
  ease: number; // SM-2 ease factor, >= 1.3
  reps: number; // consecutive successful reviews
  interval: number; // days until the review above was scheduled
}

export interface Card {
  // Stable id derived from the card's content, for React keys and de-duping.
  id: string;
  kind: CardKind;
  front: string; // question, or cloze text with the answer blanked
  back: string; // answer, or the full cloze text
  // The card's source line WITHOUT its <!-- sr ... --> comment. Used to locate
  // and rewrite the card in a body when its schedule changes.
  content: string;
  srs: SrsState | null; // null = never reviewed
}

export type Grade = "again" | "hard" | "good" | "easy";

// --- date helpers -----------------------------------------------------------

export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return todayKey(dt);
}

// --- srs comment (de)serialization -----------------------------------------

const SR_RE = /\s*<!--\s*sr\s+([^>]*?)\s*-->\s*$/;

function parseSrs(comment: string): SrsState | null {
  const fields: Record<string, string> = {};
  for (const pair of comment.trim().split(/\s+/)) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    fields[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  if (!fields.due) return null;
  const ease = Number(fields.ease);
  const reps = Number(fields.reps);
  const interval = Number(fields.int);
  return {
    due: fields.due,
    ease: Number.isFinite(ease) ? ease : 2.5,
    reps: Number.isFinite(reps) ? reps : 0,
    interval: Number.isFinite(interval) ? interval : 0,
  };
}

export function serializeSrs(srs: SrsState): string {
  return `<!-- sr due=${srs.due} ease=${srs.ease.toFixed(2)} reps=${srs.reps} int=${srs.interval} -->`;
}

// --- parsing ----------------------------------------------------------------

// Cheap deterministic id so the same card keeps its id across reloads.
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const CLOZE_RE = /\{\{([^}]+)\}\}|==([^=]+)==/g;

// Turn one already-comment-stripped source line into a Card, or null if it
// isn't a card. `kind` is inferred: `::` → basic, cloze markers → cloze.
function cardFromContent(content: string, srs: SrsState | null): Card | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Basic: split on the first "::" that isn't part of ":::" (reversed cards,
  // out of scope for the MVP).
  const dbl = trimmed.indexOf("::");
  if (dbl !== -1 && trimmed[dbl + 2] !== ":") {
    const front = trimmed.slice(0, dbl).trim();
    const back = trimmed.slice(dbl + 2).trim();
    if (front && back) {
      return { id: hashId(content), kind: "basic", front, back, content, srs };
    }
  }

  // Cloze: at least one {{…}} or ==…== span.
  CLOZE_RE.lastIndex = 0;
  if (CLOZE_RE.test(trimmed)) {
    const back = trimmed.replace(CLOZE_RE, (_m, a, b) => (a ?? b).trim());
    const front = trimmed.replace(CLOZE_RE, "…"); // …
    return { id: hashId(content), kind: "cloze", front, back, content, srs };
  }

  return null;
}

// Extract every card from a note body. Lines inside fenced code blocks are
// skipped so ``` examples ``` never become cards.
export function parseCards(body: string): Card[] {
  const cards: Card[] = [];
  let inFence = false;

  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = line.match(SR_RE);
    const srs = m ? parseSrs(m[1]) : null;
    const content = m ? line.slice(0, m.index).replace(/\s+$/, "") : line;

    const card = cardFromContent(content, srs);
    if (card) cards.push(card);
  }

  return cards;
}

export function isDue(card: Card, today: string = todayKey()): boolean {
  return card.srs === null || card.srs.due <= today;
}

// --- scheduling (SM-2) ------------------------------------------------------

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

// Apply a grade to a card's current schedule and return the next SrsState.
export function schedule(
  srs: SrsState | null,
  grade: Grade,
  today: string = todayKey()
): SrsState {
  const q = QUALITY[grade];
  let ease = srs?.ease ?? 2.5;
  let reps = srs?.reps ?? 0;
  let interval = srs?.interval ?? 0;

  // SM-2 ease update, clamped to the conventional 1.3 floor.
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    // Lapse: reset the streak and re-show today (interval 0 → due today).
    reps = 0;
    interval = 0;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    // "Easy" nudges the interval out a little further.
    if (grade === "easy") interval = Math.round(interval * 1.3);
  }

  return { due: addDays(today, interval), ease, reps, interval };
}

// --- write-back -------------------------------------------------------------

// Rewrite a single card's schedule inside a body, matched by its content line.
// Returns the new body, or null if no line matches (card was edited/removed).
export function updateCardSchedule(
  body: string,
  content: string,
  srs: SrsState
): string | null {
  const lines = body.split("\n");
  const target = content.trim();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SR_RE);
    const bare = (m ? lines[i].slice(0, m.index) : lines[i]).replace(/\s+$/, "");
    if (bare.trim() === target) {
      lines[i] = `${bare} ${serializeSrs(srs)}`;
      return lines.join("\n");
    }
  }
  return null;
}
