import { notFound } from "next/navigation";
import { listFolder, readFile, GitHubError } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";
import { NoteView } from "./NoteView";

const VALID_GARDENS = ["ai", "world", "culture", "misc"] as const;

// Build a vault-wide map: normalized note name -> its route.
// Wikilinks in Obsidian resolve across the whole vault, not one garden.
// A missing/failing folder is skipped so it can't break link resolution.
async function buildLinkMap(): Promise<Record<string, string>> {
  const perGarden = await Promise.all(
    VALID_GARDENS.map(async (g) => {
      try {
        const files = await listFolder(g);
        return files.map((f) => [f.name, g] as const);
      } catch (e) {
        log.warn("note", `link map: skipping "${g}": ${errMessage(e)}`);
        return [] as (readonly [string, Garden])[];
      }
    })
  );

  const map: Record<string, string> = {};
  for (const [name, g] of perGarden.flat()) {
    // Last write wins on name collision across gardens — good enough for
    // wikilink resolution, which is filename-based.
    map[name.toLowerCase()] = `/garden/${g}/${encodeURIComponent(name)}`;
  }
  return map;
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ garden: string; note: string }>;
}) {
  const { garden, note } = await params;

  if (!VALID_GARDENS.includes(garden as Garden)) notFound();
  const gardenId = garden as Garden;
  const name = decodeURIComponent(note);
  const path = `${gardenId}/${name}.md`;

  let noteData;
  try {
    noteData = await readFile(path);
  } catch (e) {
    // A genuine 404 → note-not-found page. Anything else (auth, network,
    // missing env) is a real failure and should surface, not masquerade
    // as a missing note.
    if (e instanceof GitHubError && e.status === 404) notFound();
    log.error("note", `load failed for "${path}": ${errMessage(e)}`);
    throw e;
  }

  const linkMap = await buildLinkMap();
  const title =
    (noteData.frontmatter.title as string | undefined) ?? noteData.name;
  const isFoundation = !!noteData.frontmatter.foundation;

  return (
    <NoteView
      title={title}
      garden={gardenId}
      body={noteData.body}
      frontmatter={noteData.frontmatter}
      isFoundation={isFoundation}
      linkMap={linkMap}
    />
  );
}

// Ensure a fresh read on each request — notes change in the repo.
export const dynamic = "force-dynamic";
