import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCorpus } from "@/lib/corpus";
import { extractWikilinks } from "@/lib/markdown";
import type { Garden } from "@/lib/types";

const VALID_GARDENS = ["ai", "world", "culture", "misc"] as const;
const GARDEN_LABELS: Record<Garden, string> = {
  ai: "AI",
  world: "World",
  culture: "Culture",
  misc: "Misc",
};

export const dynamic = "force-dynamic";

export default async function GapsPage({
  params,
}: {
  params: Promise<{ garden: string }>;
}) {
  const { garden } = await params;
  if (!VALID_GARDENS.includes(garden as Garden)) notFound();
  const gardenId = garden as Garden;

  const corpus = await loadCorpus();
  // Existing note names across the WHOLE vault — wikilinks resolve vault-wide.
  const existing = new Set(corpus.map((d) => d.name.toLowerCase()));

  // A gap = a wikilink in this garden's notes that resolves to no existing note.
  const gaps = new Map<string, { title: string; sources: Map<string, string> }>();
  for (const doc of corpus) {
    if (doc.garden !== gardenId) continue;
    const sourceTitle = (doc.frontmatter.title as string) ?? doc.name;
    for (const target of extractWikilinks(doc.body)) {
      const key = target.toLowerCase();
      if (existing.has(key)) continue;
      const entry = gaps.get(key) ?? { title: target, sources: new Map() };
      entry.sources.set(doc.name, sourceTitle);
      gaps.set(key, entry);
    }
  }

  const sorted = [...gaps.values()].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 sticky top-0 bg-zinc-50/90 backdrop-blur-sm z-10">
          <Link
            href={`/garden/${gardenId}`}
            className="tap text-sm text-zinc-500 active:text-zinc-900"
          >
            ← {GARDEN_LABELS[gardenId]}
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900">Gaps</h1>
          <span className="ml-auto text-sm text-zinc-400 tabular-nums">
            {sorted.length}
          </span>
        </div>

        {sorted.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-zinc-400">
            No gaps — your wikilinks are all connected.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 px-4 pb-24">
            {sorted.map((gap) => {
              const sources = [...gap.sources.entries()];
              return (
                <li
                  key={gap.title.toLowerCase()}
                  className="rounded-2xl bg-white border border-zinc-100 p-4 flex flex-col gap-2"
                >
                  {/* Tap the gap to create it via capture, pre-filled. */}
                  <Link
                    href={`/capture?title=${encodeURIComponent(
                      gap.title
                    )}&garden=${gardenId}`}
                    className="flex items-center gap-2 active:opacity-60"
                  >
                    <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-sm leading-none flex items-center justify-center shrink-0">
                      +
                    </span>
                    <span className="text-sm font-medium text-zinc-900 leading-snug">
                      {gap.title}
                    </span>
                  </Link>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Referenced by{" "}
                    {sources.map(([name, title], i) => (
                      <span key={name}>
                        {i > 0 && ", "}
                        <Link
                          href={`/garden/${gardenId}/${encodeURIComponent(name)}`}
                          className="text-zinc-500 underline underline-offset-2 active:text-zinc-900"
                        >
                          {title}
                        </Link>
                      </span>
                    ))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
