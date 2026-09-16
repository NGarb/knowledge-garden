// Server-side I/O for Free Recall: maps the corpus into the pure builder's
// input, and persists attempt history to the git content repo. Kept apart from
// lib/recall.ts so that module stays dependency-free and unit-testable.

import { readFile, writeFile, GitHubError } from "./github";
import { loadCorpus } from "./corpus";
import { extractWikilinks } from "./markdown";
import type { Garden } from "./types";
import type { RecallNote } from "./recall";

// Attempts live OUTSIDE the garden folders so loadCorpus (which scans only the
// five gardens) never sees them — no leak into search, mastery, or gaps.
function logPath(garden: Garden): string {
  return `recall/${garden}.json`;
}

export interface RecallAttempt {
  id: string;
  topicKey: string; // stable key, for grouping history by topic
  topic: string; // display label at the time
  kind: "cluster" | "thesis";
  at: string; // ISO timestamp
  dump: string;
  covered: string[];
  missed: string[];
  shaky: string[];
  freeGaps: string;
  feel?: number; // 1..5, optional
}

// Build the pure builder's input for one garden from the (cached) corpus.
export async function loadRecallNotes(garden: Garden): Promise<RecallNote[]> {
  const corpus = await loadCorpus();
  return corpus
    .filter((d) => d.garden === garden)
    .map((d) => {
      const fm = d.frontmatter;
      return {
        name: d.name,
        title: (fm.title as string) ?? d.name,
        type: (fm.type as string) ?? "fact",
        tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
        foundation: !!fm.foundation,
        category: (fm.category as string) ?? "Uncategorized",
        wikilinks: extractWikilinks(d.body),
      };
    });
}

// Read the attempt log, or [] if none exists yet. Also returns the blob sha so
// a follow-up append writes against the current version.
export async function readLog(
  garden: Garden
): Promise<{ attempts: RecallAttempt[]; sha: string | null }> {
  try {
    const file = await readFile(logPath(garden));
    const attempts = JSON.parse(file.body || "[]") as RecallAttempt[];
    return { attempts: Array.isArray(attempts) ? attempts : [], sha: file.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      return { attempts: [], sha: null };
    }
    throw e;
  }
}

// Append one attempt to the log (newest last) and write it back.
export async function appendAttempt(
  garden: Garden,
  attempt: RecallAttempt
): Promise<void> {
  const { attempts, sha } = await readLog(garden);
  attempts.push(attempt);
  const content = JSON.stringify(attempts, null, 2) + "\n";
  await writeFile(logPath(garden), content, {
    message: `recall: log attempt on "${attempt.topic}"`,
    ...(sha ? { sha } : {}),
  });
}
