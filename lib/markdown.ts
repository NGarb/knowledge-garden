export interface ParsedNote {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseNote(raw: string): ParsedNote {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw.trim() };

  const [, yaml, body] = match;
  const frontmatter: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const raw_value = line.slice(colon + 1).trim();
    if (!key) continue;
    frontmatter[key] = parseValue(raw_value);
  }

  return { frontmatter, body: body.trim() };
}

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "") return null;

  // JSON array: ["a", "b"]
  if (raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  // Quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  // Number
  const num = Number(raw);
  if (!isNaN(num) && raw !== "") return num;

  return raw;
}

export function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines = Object.entries(fm).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
    if (typeof v === "boolean") return `${k}: ${v}`;
    if (typeof v === "number") return `${k}: ${v}`;
    if (v === null) return `${k}: null`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join("\n")}\n---`;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractWikilinks(body: string): string[] {
  const matches = body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g);
  return [...matches].map((m) => m[1].trim());
}
