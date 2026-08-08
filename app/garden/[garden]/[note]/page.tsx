import { notFound } from "next/navigation";
import { listFolder, readFile } from "@/lib/github";
import type { Garden } from "@/lib/types";
import { NoteView } from "./NoteView";

const VALID_GARDENS = ["ai", "world", "culture", "misc"] as const;

// Build a vault-wide map: normalized note name -> its route.
// Wikilinks in Obsidian resolve across the whole vault, not one garden.
async function buildLinkMap(): Promise<Record<string, string>> {
  const perGarden = await Promise.all(
    VALID_GARDENS.map(async (g) => {
      const files = await listFolder(g);
      return files.map((f) => [f.name, g] as const);
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
  } catch {
    notFound();
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
