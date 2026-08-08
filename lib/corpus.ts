import { listFolder, readFile } from "./github";
import { log, errMessage } from "./log";
import type { Garden, Note } from "./types";

export type SearchDoc = Note & { garden: Garden };

const GARDENS: Garden[] = ["ai", "world", "culture", "misc"];

// Loading every note across all gardens is a lot of GitHub calls, so cache
// the corpus briefly in-module. A warm serverless instance reuses it across
// keystrokes; a cold one just reloads. Short TTL keeps search reasonably fresh.
const TTL_MS = 60_000;
let cache: { at: number; docs: SearchDoc[] } | null = null;

export async function loadCorpus(): Promise<SearchDoc[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.docs;

  const perGarden = await Promise.all(
    GARDENS.map(async (g) => {
      try {
        const files = await listFolder(g);
        const notes = await Promise.all(files.map((f) => readFile(f.path)));
        return notes.map((n) => ({ ...n, garden: g }));
      } catch (e) {
        // A missing/failing garden (e.g. no "misc" folder) shouldn't sink search.
        log.warn("search", `skipping "${g}": ${errMessage(e)}`);
        return [] as SearchDoc[];
      }
    })
  );

  const docs = perGarden.flat();
  cache = { at: Date.now(), docs };
  log.debug("search", `corpus loaded: ${docs.length} notes`);
  return docs;
}
