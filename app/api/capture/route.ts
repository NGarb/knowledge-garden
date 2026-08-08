import { NextResponse } from "next/server";
import { writeFile } from "@/lib/github";
import { serializeFrontmatter, slugify } from "@/lib/markdown";
import type { Garden, GitHubApiError } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["ai", "world", "culture", "misc"];

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

  const slug = slugify(title);
  if (!slug) {
    return NextResponse.json(
      { error: "Title needs at least one letter or number." },
      { status: 400 }
    );
  }

  const path = `${garden}/${slug}.md`;
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
    await writeFile(path, content, { message: `garden: capture ${slug}` });
  } catch (e) {
    const err = e as GitHubApiError;
    // Creating a file that already exists comes back 422 (sha required).
    if (err?.status === 422) {
      return NextResponse.json(
        { error: "A note with this title already exists in that garden." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err?.message ?? "Failed to save note." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    route: `/garden/${garden}/${encodeURIComponent(slug)}`,
  });
}
