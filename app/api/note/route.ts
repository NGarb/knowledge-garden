import { NextResponse } from "next/server";
import { readFile, writeFile, GitHubError } from "@/lib/github";
import { log, errMessage } from "@/lib/log";
import { extractFrontmatterBlock } from "@/lib/markdown";

const VALID_GARDENS = ["priorities", "ai", "world", "culture", "misc"];

// Update a note's body in place. The frontmatter is re-read from the repo and
// preserved verbatim — only the body below it is replaced — so metadata can
// never be clobbered by a lossy client roundtrip. Re-reading also yields the
// current blob sha, so a stale client never has to supply one.
export async function PUT(req: Request) {
  let payload: { path?: unknown; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const path = String(payload.path ?? "").trim();
  const body = String(payload.body ?? "");

  // Constrain writes to note files inside a real garden — same shape of guard
  // the image route uses, so this can't be pointed at arbitrary repo files.
  const segments = path.split("/");
  const looksSafe =
    !path.includes("..") &&
    segments.length === 2 &&
    VALID_GARDENS.includes(segments[0]) &&
    path.endsWith(".md");
  if (!looksSafe) {
    log.warn("note", `rejected edit path "${path}"`);
    return NextResponse.json({ error: "Invalid note path." }, { status: 400 });
  }

  let current;
  try {
    current = await readFile(path);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    const message = errMessage(e);
    log.error("note", `edit read failed for "${path}": ${message}`);
    return NextResponse.json(
      { error: message || "Failed to load note." },
      { status: 500 }
    );
  }

  const fmBlock = extractFrontmatterBlock(current.raw);
  const trimmedBody = body.trim();
  const content = fmBlock
    ? `${fmBlock}\n\n${trimmedBody}\n`
    : `${trimmedBody}\n`;

  try {
    await writeFile(path, content, {
      message: `garden: edit ${path}`,
      sha: current.sha,
    });
  } catch (e) {
    const message = errMessage(e);
    log.error("note", `edit write failed for "${path}": ${message}`);
    return NextResponse.json(
      { error: message || "Failed to save note." },
      { status: 500 }
    );
  }

  log.info("note", `edited ${path}`);
  return NextResponse.json({ ok: true });
}
