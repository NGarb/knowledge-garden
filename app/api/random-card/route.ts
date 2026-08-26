import { NextResponse } from "next/server";
import { listFolder, readFile } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import { parseCards, type Card } from "@/lib/flashcards";
import type { Garden } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["priorities", "ai", "world", "culture", "misc"];

interface RandomCard {
  path: string;
  garden: Garden;
  noteName: string;
  noteTitle: string;
  card: Card;
}

// GET /api/random-card?garden=ai → one random card drawn from that garden,
// ignoring review schedule. A lightweight "quiz me on anything" draw that sits
// alongside the schedule-driven /api/review deck.
export async function GET(req: Request) {
  const garden = new URL(req.url).searchParams.get("garden") ?? "";
  if (!VALID_GARDENS.includes(garden as Garden)) {
    return NextResponse.json({ error: "Unknown garden." }, { status: 400 });
  }
  const gardenId = garden as Garden;

  let pool: RandomCard[] = [];
  try {
    const files = await listFolder(gardenId);
    const notes = await Promise.all(files.map((f) => readFile(f.path)));
    for (const note of notes) {
      const title = (note.frontmatter.title as string | undefined) ?? note.name;
      for (const card of parseCards(note.body)) {
        pool.push({
          path: note.path,
          garden: gardenId,
          noteName: note.name,
          noteTitle: title,
          card,
        });
      }
    }
  } catch (e) {
    log.error("random-card", `load failed for "${gardenId}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to load cards." }, { status: 500 });
  }

  if (pool.length === 0) return NextResponse.json({ card: null, total: 0 });

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return NextResponse.json({ card: pick, total: pool.length });
}
