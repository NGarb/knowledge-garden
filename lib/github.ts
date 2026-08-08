import { parseNote } from "./markdown";
import type { Garden, Note, NoteFile } from "./types";

const REPO = process.env.GITHUB_REPO!;
const PAT = process.env.GITHUB_PAT!;
const BASE = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
    ...options,
    headers: { ...headers(), ...(options?.headers ?? {}) },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? res.statusText };
  }

  return res.json();
}

// List all .md files in a garden folder
export async function listFolder(garden: Garden): Promise<NoteFile[]> {
  const items = await ghFetch(garden);
  return (items as { name: string; path: string; sha: string; type: string }[])
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map(({ name, path, sha }) => ({
      name: name.replace(/\.md$/, ""),
      path,
      sha,
    }));
}

// Read a single file and parse frontmatter
export async function readFile(path: string): Promise<Note> {
  const item = await ghFetch(path);
  const raw = Buffer.from(item.content, "base64").toString("utf-8");
  const { frontmatter, body } = parseNote(raw);

  return {
    name: item.name.replace(/\.md$/, ""),
    path: item.path,
    sha: item.sha,
    frontmatter,
    body: body.trim(),
    raw,
  };
}

// Create or update a file (sha required for updates)
export async function writeFile(
  path: string,
  content: string,
  options: { message?: string; sha?: string } = {}
): Promise<{ sha: string }> {
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  const body = {
    message: options.message ?? `garden: update ${path}`,
    content: encoded,
    ...(options.sha ? { sha: options.sha } : {}),
  };

  const res = await ghFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { sha: res.content.sha };
}
