// One-off: seed the `priorities` garden with four starter notes.
// Run with: node --env-file=.env.local scripts/seed-priorities.mjs
import { randomUUID } from "node:crypto";

const REPO = process.env.GITHUB_REPO;
const PAT = process.env.GITHUB_PAT;
if (!REPO || !PAT) {
  console.error("Missing GITHUB_REPO / GITHUB_PAT (load .env.local).");
  process.exit(1);
}

const captured = new Date().toISOString();

const notes = [
  {
    title: "Today — Work",
    lead: "What matters most at work today.",
    items: ["Top priority for today", "Second priority", "Third priority"],
  },
  {
    title: "Today — Personal",
    lead: "What matters most in personal life today.",
    items: ["Top priority for today", "Second priority", "Third priority"],
  },
  {
    title: "This Week — Work",
    lead: "The bigger work goals for this week.",
    items: ["Main goal this week", "Second goal", "Third goal"],
  },
  {
    title: "This Week — Personal",
    lead: "The bigger personal goals for this week.",
    items: ["Main goal this week", "Second goal", "Third goal"],
  },
];

function frontmatter(title) {
  return [
    "---",
    `id: ${randomUUID()}`,
    "garden: priorities",
    "type: list",
    "category: Priorities",
    "tags: []",
    `captured: ${captured}`,
    "foundation: false",
    `title: ${title}`,
    "---",
  ].join("\n");
}

function body(note) {
  // Task text after each "[ ]" so remark-gfm renders real checkboxes (an
  // empty "- [ ]" falls back to literal text).
  const tasks = note.items.map((t) => `- [ ] ${t}`).join("\n");
  return `${note.lead}\n\n${tasks}\n\n## Notes\n`;
}

async function put(note) {
  const path = `priorities/${note.title}.md`;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${REPO}/contents/${encodedPath}`;

  // If it already exists, update in place (needs the current blob sha).
  const existing = await fetch(url, {
    headers: { Authorization: `Bearer ${PAT}`, Accept: "application/vnd.github+json" },
  });
  const sha = existing.ok ? (await existing.json()).sha : undefined;

  const content = `${frontmatter(note.title)}\n\n${body(note)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `garden: seed priorities/${note.title}`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`PUT ${path} → ${res.status} ${msg}`);
  }
  console.log(`${sha ? "updated" : "created"}: ${path}`);
}

for (const note of notes) await put(note);
console.log("done.");
