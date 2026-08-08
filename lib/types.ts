export type Garden = "ai" | "world" | "culture" | "misc";

export interface NoteFrontmatter {
  id?: string;
  garden?: Garden;
  type?: string;
  category?: string;
  tags?: string[];
  captured?: string;
  foundation?: boolean;
  country?: string;
  arc_stage?: string;
  arc_variant?: string;
  title?: string;
  [key: string]: unknown;
}

export interface NoteFile {
  name: string;      // filename without .md
  path: string;      // full repo path eg. world/China Economic Stall.md
  sha: string;
}

export interface Note extends NoteFile {
  frontmatter: NoteFrontmatter;
  body: string;      // content minus frontmatter
  raw: string;       // full raw content
}

export interface GitHubApiError {
  status: number;
  message: string;
}
