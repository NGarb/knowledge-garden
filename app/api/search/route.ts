import { NextResponse } from "next/server";
import { loadCorpus } from "@/lib/corpus";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";

const GARDEN_ORDER: Garden[] = ["ai", "world", "culture", "misc"];

interface Hit {
  garden: Garden;
  name: string;
  title: string;
  snippet: string;
  foundation: boolean;
}

// Pull a readable window around the first match; fall back to the first line
// of body for title-only matches.
function makeSnippet(body: string, ql: string): string {
  const lower = body.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) {
    const firstLine = body
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .find((l) => l.length > 0);
    return (firstLine ?? "").slice(0, 160);
  }
  const start = Math.max(0, idx - 48);
  const end = Math.min(body.length, idx + ql.length + 96);
  let s = body.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) s = "…" + s;
  if (end < body.length) s = s + "…";
  return s;
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ groups: [] });

  let hits: Hit[];
  try {
    const corpus = await loadCorpus();
    const ql = q.toLowerCase();
    hits = corpus
      .filter((n) => {
        const title = ((n.frontmatter.title as string) ?? n.name).toLowerCase();
        return title.includes(ql) || n.body.toLowerCase().includes(ql);
      })
      .map((n) => ({
        garden: n.garden,
        name: n.name,
        title: (n.frontmatter.title as string) ?? n.name,
        snippet: makeSnippet(n.body, ql),
        foundation: !!n.frontmatter.foundation,
      }));
  } catch (e) {
    log.error("search", `query "${q}" failed: ${errMessage(e)}`);
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }

  // Group by garden in a stable order, dropping empty groups.
  const groups = GARDEN_ORDER.map((garden) => ({
    garden,
    hits: hits
      .filter((h) => h.garden === garden)
      .sort((a, b) => a.title.localeCompare(b.title)),
  })).filter((g) => g.hits.length > 0);

  return NextResponse.json({ groups });
}
