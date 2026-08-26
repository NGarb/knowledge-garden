import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCorpus } from "@/lib/corpus";
import { parseCards, todayKey, type Card } from "@/lib/flashcards";
import type { Garden } from "@/lib/types";

const VALID_GARDENS = ["priorities", "ai", "world", "culture", "misc"] as const;
const GARDEN_LABELS: Record<Garden, string> = {
  priorities: "Priorities",
  ai: "AI",
  world: "World",
  culture: "Culture",
  misc: "Misc",
};

export const dynamic = "force-dynamic";

// A card is one of three states: never reviewed ("new"), due today/overdue
// ("review"), or scheduled into the future — i.e. currently retained ("known").
type CardState = "new" | "review" | "known";

function cardState(card: Card, today: string): CardState {
  if (!card.srs) return "new";
  return card.srs.due <= today ? "review" : "known";
}

interface Tally {
  new: number;
  review: number;
  known: number;
}

function emptyTally(): Tally {
  return { new: 0, review: 0, known: 0 };
}

function addTally(a: Tally, b: Tally): Tally {
  return { new: a.new + b.new, review: a.review + b.review, known: a.known + b.known };
}

function total(t: Tally): number {
  return t.new + t.review + t.known;
}

// "Mastery" = share of a concept's cards currently retained (scheduled out).
function masteryPct(t: Tally): number {
  const n = total(t);
  return n === 0 ? 0 : Math.round((t.known / n) * 100);
}

interface ConceptRow {
  name: string;
  title: string;
  route: string;
  foundation: boolean;
  repo: string | null;
  tally: Tally;
}

interface CategoryGroup {
  category: string;
  concepts: ConceptRow[];
  tally: Tally;
  due: number;
  foundationCount: number;
  repoCount: number;
}

// Normalize a frontmatter repo value into a browsable URL. Accepts a full URL
// or the "owner/repo" shorthand.
function repoUrl(repo: string): string {
  if (/^https?:\/\//.test(repo)) return repo;
  return `https://github.com/${repo}`;
}

// A thin three-segment bar: retained (known) / due (review) / new. Widths are
// percentages of the concept-or-category card total.
function ProgressBar({ tally }: { tally: Tally }) {
  const n = total(tally);
  const pct = (v: number) => (n === 0 ? 0 : (v / n) * 100);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className="bg-emerald-500" style={{ width: `${pct(tally.known)}%` }} />
      <div className="bg-amber-400" style={{ width: `${pct(tally.review)}%` }} />
      <div className="bg-zinc-300" style={{ width: `${pct(tally.new)}%` }} />
    </div>
  );
}

export default async function MasteryPage({
  params,
}: {
  params: Promise<{ garden: string }>;
}) {
  const { garden } = await params;
  if (!VALID_GARDENS.includes(garden as Garden)) notFound();
  const gardenId = garden as Garden;

  const today = todayKey();
  const corpus = await loadCorpus();

  // Group this garden's notes into concept rows keyed by frontmatter category.
  const byCategory = new Map<string, ConceptRow[]>();
  for (const doc of corpus) {
    if (doc.garden !== gardenId) continue;

    const tally = emptyTally();
    for (const card of parseCards(doc.body)) tally[cardState(card, today)] += 1;

    const category = (doc.frontmatter.category as string)?.trim() || "Uncategorized";
    const repoRaw = doc.frontmatter.repo;
    const row: ConceptRow = {
      name: doc.name,
      title: (doc.frontmatter.title as string) ?? doc.name,
      route: `/garden/${gardenId}/${encodeURIComponent(doc.name)}`,
      foundation: !!doc.frontmatter.foundation,
      repo: typeof repoRaw === "string" && repoRaw ? repoRaw : null,
      tally,
    };
    const list = byCategory.get(category) ?? [];
    list.push(row);
    byCategory.set(category, list);
  }

  // Roll each category up, then sort so the categories with the most work left
  // to review float to the top; concepts within a category lead with foundations.
  const groups: CategoryGroup[] = [...byCategory.entries()].map(
    ([category, concepts]) => {
      const tally = concepts.reduce((acc, c) => addTally(acc, c.tally), emptyTally());
      concepts.sort((a, b) => {
        if (a.foundation !== b.foundation) return a.foundation ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
      return {
        category,
        concepts,
        tally,
        due: tally.new + tally.review,
        foundationCount: concepts.filter((c) => c.foundation).length,
        repoCount: concepts.filter((c) => c.repo).length,
      };
    }
  );
  groups.sort((a, b) => b.due - a.due || b.concepts.length - a.concepts.length);

  const overall = groups.reduce((acc, g) => addTally(acc, g.tally), emptyTally());
  const conceptCount = groups.reduce((n, g) => n + g.concepts.length, 0);
  const foundationCount = groups.reduce((n, g) => n + g.foundationCount, 0);
  const dueNow = overall.new + overall.review;

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
          <h1 className="text-lg font-semibold text-zinc-900">Mastery</h1>
          <span className="ml-auto text-sm text-zinc-400 tabular-nums">
            {masteryPct(overall)}%
          </span>
        </div>

        {conceptCount === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-zinc-400">
            No concepts here yet. Add notes with a{" "}
            <code className="text-zinc-500">category</code> and some{" "}
            <code className="text-zinc-500">front :: back</code> cards to start
            tracking mastery.
          </p>
        ) : (
          <>
            {/* Overall summary */}
            <div className="mx-4 mt-2 mb-4 rounded-2xl bg-white border border-zinc-100 p-4 flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-3xl font-semibold tabular-nums text-zinc-900 leading-none">
                    {masteryPct(overall)}%
                  </span>
                  <span className="mt-1 text-xs text-zinc-400">retained</span>
                </div>
                <div className="flex gap-4 text-right">
                  <Stat label="Concepts" value={conceptCount} />
                  <Stat label="Foundation" value={foundationCount} />
                  <Stat label="Cards" value={total(overall)} />
                </div>
              </div>
              <ProgressBar tally={overall} />
              {dueNow > 0 ? (
                <Link
                  href="/review"
                  className="tap flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white active:opacity-80"
                >
                  Review {dueNow} due {dueNow === 1 ? "card" : "cards"}
                </Link>
              ) : total(overall) > 0 ? (
                <p className="text-center text-xs text-emerald-600">
                  All caught up — nothing due right now.
                </p>
              ) : null}
              <Link
                href={`/garden/${gardenId}/gaps`}
                className="tap text-center text-xs text-zinc-400 active:text-zinc-700"
              >
                See knowledge gaps →
              </Link>
            </div>

            {/* Category breakdown */}
            <ul className="flex flex-col gap-3 px-4 pb-24">
              {groups.map((g) => (
                <li
                  key={g.category}
                  className="rounded-2xl bg-white border border-zinc-100 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {g.category}
                    </h2>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {masteryPct(g.tally)}%
                    </span>
                    {g.due > 0 && (
                      <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 tabular-nums">
                        {g.due} to review
                      </span>
                    )}
                  </div>

                  <ProgressBar tally={g.tally} />

                  <ul className="flex flex-col divide-y divide-zinc-50">
                    {g.concepts.map((c) => {
                      const n = total(c.tally);
                      return (
                        <li key={c.name}>
                          <Link
                            href={c.route}
                            className="flex items-center gap-2 py-2 active:opacity-60"
                          >
                            {c.foundation && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0"
                                title="Foundation note"
                              />
                            )}
                            <span className="text-sm text-zinc-800 leading-snug min-w-0 truncate">
                              {c.title}
                            </span>
                            {c.repo && (
                              <span
                                className="text-xs text-zinc-300 shrink-0"
                                title="Has a linked repo"
                              >
                                {"</>"}
                              </span>
                            )}
                            <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-400">
                              {n === 0 ? (
                                "no cards"
                              ) : (
                                <>
                                  <span className="text-emerald-600">{c.tally.known}</span>
                                  {" / "}
                                  {n}
                                </>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums text-zinc-900 leading-none">
        {value}
      </span>
      <span className="mt-1 text-xs text-zinc-400">{label}</span>
    </div>
  );
}
