import Link from "next/link";
import { listFolder } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";

const GARDENS: { id: Garden; label: string; description: string }[] = [
  { id: "world", label: "World", description: "Geopolitics, economics, history" },
  { id: "ai", label: "AI", description: "Models, papers, tools" },
  { id: "culture", label: "Culture", description: "Language, place, people" },
  { id: "misc", label: "Misc", description: "Everything else" },
];

async function GardenCard({ id, label, description }: (typeof GARDENS)[number]) {
  let count = 0;
  try {
    const notes = await listFolder(id);
    count = notes.length;
  } catch (e) {
    // Degrade to 0 on the card, but make the reason visible in the logs.
    log.error("home", `count failed for "${id}": ${errMessage(e)}`);
  }

  return (
    <Link
      href={`/garden/${id}`}
      className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">{label}</h2>
        <span className="text-sm font-medium text-zinc-400 tabular-nums">{count}</span>
      </div>
      <p className="text-sm text-zinc-500 leading-snug">{description}</p>
    </Link>
  );
}

// Counts are read live from the repo on every request.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-svh bg-zinc-50 px-4 pt-safe">
      <div className="max-w-lg mx-auto py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Garden</h1>
          <p className="text-sm text-zinc-500">Your Zettelkasten</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {GARDENS.map((g) => (
            <GardenCard key={g.id} {...g} />
          ))}
        </div>
      </div>
    </main>
  );
}
