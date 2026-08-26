import { NextResponse } from "next/server";
import { writeFile, GitHubError } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import { serializeFrontmatter, noteBasename } from "@/lib/markdown";
import type { Garden } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["priorities", "ai", "world", "culture", "misc"];

export async function POST(req: Request) {
  let payload: { title?: unknown; body?: unknown; garden?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const garden = payload.garden as Garden;

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!VALID_GARDENS.includes(garden)) {
    return NextResponse.json({ error: "Pick a garden." }, { status: 400 });
  }

  // Name the file after the display title (Obsidian-style) so [[wikilinks]] to
  // this title resolve to it — a slug like "agent-eval" would never match.
  const name = noteBasename(title);
  if (!name || !/[\p{L}\p{N}]/u.test(name)) {
    return NextResponse.json(
      { error: "Title needs at least one letter or number." },
      { status: 400 }
    );
  }

  const path = `${garden}/${name}.md`;
  const frontmatter = serializeFrontmatter({
    id: crypto.randomUUID(),
    garden,
    type: "fact",
    category: "Uncategorized",
    tags: [],
    captured: new Date().toISOString(),
    foundation: false,
  });
  const content = `${frontmatter}\n\n${body}\n`;

  try {
    await writeFile(path, content, { message: `garden: capture ${name}` });
  } catch (e) {
    // Creating a file that already exists comes back 422 (sha required).
    if (e instanceof GitHubError && e.status === 422) {
      log.warn("capture", `duplicate note rejected: ${path}`);
      return NextResponse.json(
        { error: "A note with this title already exists in that garden." },
        { status: 409 }
      );
    }
    const message = errMessage(e);
    log.error("capture", `write failed for "${path}": ${message}`);
    return NextResponse.json(
      { error: message || "Failed to save note." },
      { status: 500 }
    );
  }

  log.info("capture", `captured ${path}`);
  return NextResponse.json({
    ok: true,
    route: `/garden/${garden}/${encodeURIComponent(name)}`,
  });
}
