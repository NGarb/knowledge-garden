// Pure helpers for editing a checklist stored as GFM task lines inside a note
// body. Every function takes the full body string and returns a new one, so the
// note's prose (a lead line, a "## Notes" section) always rides along untouched.
// Kept framework-free so the logic can be unit-tested in isolation.

// Optional indent, "- [ ]"/"- [x]", then the task text. Group 3 keeps any
// trailing Tasks-plugin metadata (e.g. "📅 2026-08-24") so Obsidian round-trips.
export const TASK_RE = /^(\s*)- \[([ xX])\]\s?(.*)$/;

export interface Task {
  lineIndex: number;
  checked: boolean;
  text: string;
}

export interface ParsedBody {
  preProse: string; // content before the first task
  tasks: Task[];
  postProse: string; // content after the last task
  doneCount: number;
}

export function parseBody(body: string): ParsedBody {
  const lines = body.split("\n");
  const taskIdxs: number[] = [];
  lines.forEach((l, i) => {
    if (TASK_RE.test(l)) taskIdxs.push(i);
  });

  if (taskIdxs.length === 0) {
    return { preProse: body, tasks: [], postProse: "", doneCount: 0 };
  }

  const first = taskIdxs[0];
  const last = taskIdxs[taskIdxs.length - 1];
  const tasks: Task[] = taskIdxs.map((i) => {
    const m = lines[i].match(TASK_RE)!;
    return { lineIndex: i, checked: m[2] !== " ", text: m[3] };
  });

  return {
    preProse: lines.slice(0, first).join("\n"),
    tasks,
    postProse: lines.slice(last + 1).join("\n"),
    doneCount: tasks.filter((t) => t.checked).length,
  };
}

export function toggleTask(body: string, lineIndex: number): string {
  const lines = body.split("\n");
  lines[lineIndex] = lines[lineIndex].replace(/- \[([ xX])\]/, (_m, c: string) =>
    c === " " ? "- [x]" : "- [ ]"
  );
  return lines.join("\n");
}

export function editTaskText(body: string, lineIndex: number, text: string): string {
  const lines = body.split("\n");
  lines[lineIndex] = lines[lineIndex].replace(
    /^(\s*- \[[ xX]\]\s?).*/,
    (_m, prefix: string) => `${prefix}${text}`
  );
  return lines.join("\n");
}

export function removeTask(body: string, lineIndex: number): string {
  const lines = body.split("\n");
  lines.splice(lineIndex, 1);
  return lines.join("\n");
}

export function addTask(body: string, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return body;
  const lines = body.split("\n");
  const { tasks } = parseBody(body);
  // Slot the new task right after the last existing one; failing that, above
  // the first heading (e.g. "## Notes"); failing that, at the end.
  let insertAt: number;
  if (tasks.length) {
    insertAt = tasks[tasks.length - 1].lineIndex + 1;
  } else {
    const heading = lines.findIndex((l) => /^#{1,6}\s/.test(l));
    insertAt = heading >= 0 ? heading : lines.length;
  }
  lines.splice(insertAt, 0, `- [ ] ${trimmed}`);
  return lines.join("\n");
}

export function clearDone(body: string): string {
  const { tasks } = parseBody(body);
  const doneIdx = new Set(tasks.filter((t) => t.checked).map((t) => t.lineIndex));
  return body
    .split("\n")
    .filter((_, i) => !doneIdx.has(i))
    .join("\n");
}
