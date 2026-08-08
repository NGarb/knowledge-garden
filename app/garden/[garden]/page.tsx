import Link from "next/link";
import { notFound } from "next/navigation";
import { listFolder, readFile, GitHubError } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import type { Garden, Note } from "@/lib/types";

const VALID_GARDENS = ["ai", "world", "culture", "misc"] as const;
const GARDEN_LABELS: Record<Garden, string> = {
  ai: "AI",
  world: "World",
  culture: "Culture",
  misc: "Misc",
};

function firstLine(body: string): string {
  return (
    body
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .find((l) => l.length > 0) ?? ""
  );
}

// Notes are read live from the repo on every request.
export const dynamic = "force-dynamic";

export default async function GardenPage({
  params,
}: {
  params: Promise<{ garden: string }>;
}) {
  const { garden } = await params;

  if (!VALID_GARDENS.includes(garden as Garden)) notFound();
  const gardenId = garden as Garden;

  let sorted: Note[] = [];
  let loadError: string | null = null;

  try {
    const files = await listFolder(gardenId);
    const notes = await Promise.all(files.map((f) => readFile(f.path)));

    // Foundation notes first, then alphabetical
    sorted = notes.sort((a, b) => {
      const aF = a.frontmatter.foundation ? 1 : 0;
      const bF = b.frontmatter.foundation ? 1 : 0;
      if (bF !== aF) return bF - aF;
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      // Folder doesn't exist in the repo yet — treat as an empty garden.
      log.warn("garden", `folder "${gardenId}" not found — showing empty`);
    } else {
      loadError = errMessage(e);
      log.error("garden", `load failed for "${gardenId}": ${loadError}`);
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 sticky top-0 bg-zinc-50/90 backdrop-blur-sm">
          <Link href="/" className="text-sm text-zinc-500 active:text-zinc-900">
            ← Gardens
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900">
            {GARDEN_LABELS[gardenId]}
          </h1>
          <Link
            href={`/garden/${gardenId}/gaps`}
            className="ml-auto text-sm text-zinc-500 active:text-zinc-900"
          >
            Gaps
          </Link>
          <span className="text-sm text-zinc-400 tabular-nums">
            {loadError ? "—" : sorted.length}
          </span>
        </div>

        {/* Note list */}
        {loadError ? (
          <div className="mx-4 mt-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-4">
            <p className="text-sm font-medium text-red-700">
              Couldn&apos;t load this garden
            </p>
            <p className="mt-1 text-sm text-red-600 break-words">{loadError}</p>
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-zinc-400">
            No notes yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 px-4">
            {sorted.map((note) => {
              const title =
                (note.frontmatter.title as string | undefined) ?? note.name;
              const preview = firstLine(note.body);
              const isFoundation = !!note.frontmatter.foundation;
              const slug = encodeURIComponent(note.name);

              return (
                <li key={note.path}>
                  <Link
                    href={`/garden/${gardenId}/${slug}`}
                    className="flex flex-col gap-1 py-4 active:opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      {isFoundation && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0"
                          title="Foundation note"
                        />
                      )}
                      <span className="text-sm font-medium text-zinc-900 leading-snug">
                        {title}
                      </span>
                    </div>
                    {preview && (
                      <p className="text-sm text-zinc-500 leading-snug line-clamp-2">
                        {preview}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
