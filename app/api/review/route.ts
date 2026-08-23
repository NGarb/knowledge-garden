import { NextResponse } from "next/server";
import { readFile, writeFile, GitHubError } from "@/lib/github";
import { loadCorpus } from "@/lib/corpus";
import { extractFrontmatterBlock } from "@/lib/markdown";
import { log, errMessage } from "@/lib/log";
import {
  parseCards,
  isDue,
  schedule,
  updateCardSchedule,
  todayKey,
  type Grade,
  type Card,
} from "@/lib/flashcards";
import type { Garden } from "@/lib/types";

const VALID_GARDENS = ["priorities", "ai", "world", "culture", "misc"];
const GRADES = ["again", "hard", "good", "easy"];
const MAX_CARDS = 100;

interface DueCard {
  path: string;
  garden: Garden;
  noteName: string;
  noteTitle: string;
  card: Card;
}

// GET /api/review          → due cards across every garden (capped)
// GET /api/review?count=1  → just the tally, for the home-screen badge
export async function GET(req: Request) {
  const countOnly = new URL(req.url).searchParams.get("count") === "1";
  const today = todayKey();

  let due: DueCard[] = [];
  try {
    const corpus = await loadCorpus();
    for (const doc of corpus) {
      const title = (doc.frontmatter.title as string | undefined) ?? doc.name;
      for (const card of parseCards(doc.body)) {
        if (!isDue(card, today)) continue;
        due.push({
          path: doc.path,
          garden: doc.garden,
          noteName: doc.name,
          noteTitle: title,
          card,
        });
      }
    }
  } catch (e) {
    log.error("review", `load failed: ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to load cards." }, { status: 500 });
  }

  // New cards (never reviewed) after ones already scheduled and overdue.
  due.sort((a, b) => {
    const ad = a.card.srs?.due ?? "9999";
    const bd = b.card.srs?.due ?? "9999";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });

  if (countOnly) return NextResponse.json({ due: due.length });
  return NextResponse.json({ due: due.slice(0, MAX_CARDS), total: due.length });
}

// POST /api/review  { path, content, grade } → advance one card's schedule.
export async function POST(req: Request) {
  let payload: { path?: unknown; content?: unknown; grade?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const path = String(payload.path ?? "").trim();
  const content = String(payload.content ?? "");
  const grade = String(payload.grade ?? "") as Grade;

  const segments = path.split("/");
  const looksSafe =
    !path.includes("..") &&
    segments.length === 2 &&
    VALID_GARDENS.includes(segments[0]) &&
    path.endsWith(".md");
  if (!looksSafe) {
    return NextResponse.json({ error: "Invalid note path." }, { status: 400 });
  }
  if (!content.trim() || !GRADES.includes(grade)) {
    return NextResponse.json({ error: "Invalid card or grade." }, { status: 400 });
  }

  // Re-read the note so we schedule against its current state and get a fresh
  // blob sha — mirrors how /api/note avoids trusting a stale client roundtrip.
  let current;
  try {
    current = await readFile(path);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    log.error("review", `read failed for "${path}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to load note." }, { status: 500 });
  }

  // Find the card as it currently stands so we advance its real schedule.
  const existing = parseCards(current.body).find(
    (c) => c.content.trim() === content.trim()
  );
  const next = schedule(existing?.srs ?? null, grade);

  const newBody = updateCardSchedule(current.body, content, next);
  if (newBody === null) {
    // The card was edited or removed in the repo since it was served.
    return NextResponse.json({ error: "Card no longer exists." }, { status: 409 });
  }

  const fmBlock = extractFrontmatterBlock(current.raw);
  const body = newBody.trim();
  const fileContent = fmBlock ? `${fmBlock}\n\n${body}\n` : `${body}\n`;

  try {
    await writeFile(path, fileContent, {
      message: `garden: review ${path}`,
      sha: current.sha,
    });
  } catch (e) {
    log.error("review", `write failed for "${path}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, srs: next });
}
