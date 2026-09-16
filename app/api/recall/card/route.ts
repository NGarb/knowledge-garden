import { NextResponse } from "next/server";
import { readFile, writeFile, GitHubError } from "@/lib/github";
import { extractFrontmatterBlock } from "@/lib/markdown";
import { parseCards } from "@/lib/flashcards";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["priorities", "ai", "world", "culture", "misc"];

// First meaningful line of a note body, heading markers stripped — the default
// "back" for a gap card. Mirrors the garden list's preview logic.
function firstLine(body: string): string {
  return (
    body
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .find((l) => l.length > 0 && !l.startsWith("---")) ?? ""
  );
}

function resolvePath(garden: string, note: string): string | null {
  if (!VALID_GARDENS.includes(garden as Garden)) return null;
  if (!note || note.includes("/") || note.includes("..")) return null;
  return `${garden}/${note}.md`;
}

// GET /api/recall/card?garden=&note=  → a prefilled card draft for a gap:
// front = the note's title, back = its first line. Both editable client-side.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = resolvePath(
    url.searchParams.get("garden") ?? "",
    (url.searchParams.get("note") ?? "").trim()
  );
  if (!path) {
    return NextResponse.json({ error: "Invalid note." }, { status: 400 });
  }

  try {
    const note = await readFile(path);
    const title = (note.frontmatter.title as string | undefined) ?? note.name;
    return NextResponse.json({ front: title, back: firstLine(note.body) });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    log.error("recall", `card draft failed for "${path}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to load note." }, { status: 500 });
  }
}

// POST /api/recall/card  { garden, note, front, back }
// Append a `front :: back` card line to the note's body (SRS-new, due at once),
// preserving frontmatter verbatim — the bridge from a recall gap to the deck.
export async function POST(req: Request) {
  let payload: { garden?: unknown; note?: unknown; front?: unknown; back?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const path = resolvePath(String(payload.garden ?? ""), String(payload.note ?? "").trim());
  if (!path) {
    return NextResponse.json({ error: "Invalid note." }, { status: 400 });
  }
  const front = String(payload.front ?? "").trim();
  const back = String(payload.back ?? "").trim();
  if (!front || !back) {
    return NextResponse.json({ error: "Card needs a front and a back." }, { status: 400 });
  }
  if (front.includes("::") || back.includes("::")) {
    return NextResponse.json(
      { error: "Card text can't contain '::'." },
      { status: 400 }
    );
  }

  let current;
  try {
    current = await readFile(path);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    log.error("recall", `card read failed for "${path}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to load note." }, { status: 500 });
  }

  const cardLine = `${front} :: ${back}`;
  // Skip if an identical card already exists (idempotent re-taps).
  const exists = parseCards(current.body).some(
    (c) => c.content.trim() === cardLine
  );
  if (exists) {
    return NextResponse.json({ ok: true, already: true });
  }

  const fmBlock = extractFrontmatterBlock(current.raw);
  const body = `${current.body.trim()}\n\n${cardLine}`.trim();
  const fileContent = fmBlock ? `${fmBlock}\n\n${body}\n` : `${body}\n`;

  try {
    await writeFile(path, fileContent, {
      message: `recall: add card to ${path}`,
      sha: current.sha,
    });
  } catch (e) {
    log.error("recall", `card write failed for "${path}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to save card." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
