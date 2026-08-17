import { notFound } from "next/navigation";
import { listFolder, readFile, GitHubError } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";
import { NoteView } from "./NoteView";

const VALID_GARDENS = ["ai", "world", "culture", "misc"] as const;

interface VaultEntry {
  garden: Garden;
  name: string; // filename without .md
  path: string; // GitHub's exact stored path, eg. "world/China Economic Stall.md"
}

// One vault-wide listing, reused for both note resolution and the wikilink map.
// A missing/failing folder is skipped rather than breaking the whole page.
async function listVault(): Promise<VaultEntry[]> {
  const perGarden = await Promise.all(
    VALID_GARDENS.map(async (g) => {
      try {
        const files = await listFolder(g);
        return files.map((f) => ({ garden: g, name: f.name, path: f.path }));
      } catch (e) {
        log.warn("note", `vault: skipping "${g}": ${errMessage(e)}`);
        return [] as VaultEntry[];
      }
    })
  );
  return perGarden.flat();
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// This Next build hands route params through still URL-encoded (e.g. the
// filename "China Economic Stall" arrives as "China%20Economic%20Stall").
// Decode defensively — a literal '%' in a name would otherwise throw.
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ garden: string; note: string }>;
}) {
  const { garden, note } = await params;

  if (!VALID_GARDENS.includes(garden as Garden)) notFound();
  const gardenId = garden as Garden;

  const noteName = safeDecode(note);
  const vault = await listVault();

  // Resolve against the real listing so we use GitHub's exact path — never
  // reconstruct "garden/name.md", which drifts from the true filename on
  // case, whitespace, or unicode differences and 404s a note that exists.
  const inGarden = vault.filter((e) => e.garden === gardenId);
  const target =
    inGarden.find((e) => e.name === noteName) ??
    inGarden.find((e) => e.name.toLowerCase() === noteName.toLowerCase()) ??
    inGarden.find((e) => norm(e.name) === norm(noteName));

  if (!target) {
    // Log a few candidates so any hidden character in the real filename shows.
    const near = inGarden
      .filter((e) => norm(e.name).includes(norm(noteName).slice(0, 8)))
      .map((e) => e.name)
      .slice(0, 5);
    log.warn(
      "note",
      `no file in "${gardenId}" matches "${noteName}" (raw "${note}"); near: ${JSON.stringify(near)}`
    );
    notFound();
  }

  let noteData;
  try {
    noteData = await readFile(target.path);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) notFound();
    log.error("note", `load failed for "${target.path}": ${errMessage(e)}`);
    throw e;
  }

  const linkMap: Record<string, string> = {};
  for (const e of vault) {
    // Key by lowercased name for wikilink resolution; value routes to the
    // note using its exact stored name.
    linkMap[e.name.toLowerCase()] = `/garden/${e.garden}/${encodeURIComponent(e.name)}`;
  }

  const title =
    (noteData.frontmatter.title as string | undefined) ?? noteData.name;
  const isFoundation = !!noteData.frontmatter.foundation;

  // Obsidian stores attachments in "./attachments" beside the note, so for a
  // note at "misc/Foo.md" images resolve under "misc/attachments/".
  const noteDir = target.path.includes("/")
    ? target.path.slice(0, target.path.lastIndexOf("/"))
    : "";
  const attachmentsBase = noteDir ? `${noteDir}/attachments` : "attachments";

  return (
    <NoteView
      title={title}
      garden={gardenId}
      body={noteData.body}
      frontmatter={noteData.frontmatter}
      isFoundation={isFoundation}
      linkMap={linkMap}
      attachmentsBase={attachmentsBase}
    />
  );
}

// Ensure a fresh read on each request — notes change in the repo.
export const dynamic = "force-dynamic";
