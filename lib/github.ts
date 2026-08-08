import { parseNote } from "./markdown";
import { log, errMessage } from "./log";
import type { Garden, Note, NoteFile } from "./types";

const REPO = process.env.GITHUB_REPO;
const PAT = process.env.GITHUB_PAT;
const BASE = "https://api.github.com";

// A real Error subclass so `instanceof` + stack traces work, while still
// carrying the HTTP status callers branch on (404 = not found, 422 = exists…).
export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

function assertConfig() {
  const missing: string[] = [];
  if (!REPO) missing.push("GITHUB_REPO");
  if (!PAT) missing.push("GITHUB_PAT");
  if (missing.length) {
    const message = `Missing env var(s): ${missing.join(", ")}`;
    log.error("github", message);
    throw new GitHubError(500, message);
  }
}

function headers() {
  return {
    Authorization: `Bearer ${PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch(path: string, options?: RequestInit) {
  assertConfig();
  const method = options?.method ?? "GET";
  // Encode each segment so filenames containing #, ?, %, spaces, etc. survive.
  // Interpolating raw lets new URL() treat # as a fragment and ? as a query,
  // silently truncating the path and 404ing.
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${BASE}/repos/${REPO}/contents/${encodedPath}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { ...headers(), ...(options?.headers ?? {}) },
      next: { revalidate: 0 },
    });
  } catch (e) {
    // Network-level failure (DNS, TLS, timeout) — never reached GitHub.
    const message = errMessage(e);
    log.error("github", `${method} ${path} — network error: ${message}`);
    throw new GitHubError(0, message);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message ?? res.statusText;
    log.error("github", `${method} ${path} — ${res.status} ${message}`, {
      repo: REPO,
      status: res.status,
    });
    throw new GitHubError(res.status, message);
  }

  log.debug("github", `${method} ${path} — ${res.status}`);
  return res.json();
}

// List all .md files in a garden folder
export async function listFolder(garden: Garden): Promise<NoteFile[]> {
  const items = await ghFetch(garden);
  const files = (items as { name: string; path: string; sha: string; type: string }[])
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map(({ name, path, sha }) => ({
      name: name.replace(/\.md$/, ""),
      path,
      sha,
    }));
  log.debug("github", `listFolder ${garden} → ${files.length} notes`);
  return files;
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

  log.info("github", `wrote ${path}`);
  return { sha: res.content.sha };
}
