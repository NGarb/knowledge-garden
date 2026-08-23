"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import type { Garden, NoteFrontmatter } from "@/lib/types";
import {
  parseBody,
  toggleTask,
  editTaskText,
  removeTask,
  addTask as addTaskToBody,
  clearDone as clearDoneInBody,
  type Task,
} from "@/lib/tasks";

interface Props {
  title: string;
  garden: Garden;
  // GitHub's exact stored path, eg. "priorities/Today — Work.md".
  notePath: string;
  body: string;
  frontmatter: NoteFrontmatter;
  isFoundation: boolean;
  linkMap: Record<string, string>;
  attachmentsBase: string;
}

const WIKILINK_SCHEME = "wikilink:";

// react-markdown's default url sanitizer drops unknown protocols (returning
// ""), which would strip our wikilink: scheme before the anchor renderer runs.
// Let wikilinks through; keep default sanitization for every other URL.
function urlTransform(url: string): string {
  if (url.startsWith(WIKILINK_SCHEME)) return url;
  return defaultUrlTransform(url);
}

function rewriteImageEmbeds(body: string, attachmentsBase: string): string {
  return body.replace(
    /!\[\[([^\]|]+?\.(?:png|jpe?g|gif|webp|svg|avif))(?:\|([^\]]*))?\]\]/gi,
    (_, file: string, alt?: string) => {
      const label = (alt ?? file).trim();
      const src = `/api/image?path=${encodeURIComponent(
        `${attachmentsBase}/${file.trim()}`
      )}`;
      return `![${label}](${src})`;
    }
  );
}

function rewriteWikilinks(body: string): string {
  return body.replace(
    /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (_, target: string, alias?: string) => {
      const label = (alias ?? target).trim().replace(/[[\]]/g, "");
      return `[${label}](${WIKILINK_SCHEME}${encodeURIComponent(target.trim())})`;
    }
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PriorityView({
  title,
  garden,
  notePath,
  body: initialBody,
  frontmatter,
  isFoundation,
  linkMap,
  attachmentsBase,
}: Props) {
  const router = useRouter();

  // The full note body is the single source of truth. Task toggles, adds, and
  // deletes all rewrite it and persist optimistically; prose (the lead line and
  // any "## Notes" section) rides along untouched.
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Serialize writes: /api/note reads the current blob sha per request, so two
  // overlapping saves would collide. Keep only the latest body pending and
  // flush it once the in-flight save returns.
  const savingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  async function flush() {
    if (savingRef.current) return;
    const toSave = pendingRef.current;
    if (toSave == null) return;
    pendingRef.current = null;
    savingRef.current = true;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/note", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: notePath, body: toSave }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save.");
      }
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      savingRef.current = false;
      if (pendingRef.current != null) flush();
    }
  }

  function applyBody(next: string) {
    setBody(next);
    pendingRef.current = next;
    flush();
  }

  // Derive the task list and the surrounding prose from the body. Prose before
  // the first task renders above the list; prose after the last task below it.
  const { preProse, tasks, postProse, doneCount } = useMemo(
    () => parseBody(body),
    [body]
  );

  const toggle = (lineIndex: number) => applyBody(toggleTask(body, lineIndex));
  const editText = (lineIndex: number, text: string) =>
    applyBody(editTaskText(body, lineIndex, text));
  const remove = (lineIndex: number) => applyBody(removeTask(body, lineIndex));
  const addTask = (text: string) => applyBody(addTaskToBody(body, text));
  const clearDone = () => applyBody(clearDoneInBody(body));

  const metaFields = [
    frontmatter.type && { label: "Type", value: frontmatter.type },
    frontmatter.category && { label: "Category", value: frontmatter.category },
    frontmatter.captured && {
      label: "Captured",
      value: new Date(frontmatter.captured).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  function Anchor({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
    if (href?.startsWith(WIKILINK_SCHEME)) {
      const target = decodeURIComponent(href.slice(WIKILINK_SCHEME.length));
      const dest = linkMap[target.toLowerCase()];
      if (dest) {
        return (
          <Link
            href={dest}
            className="text-zinc-900 underline decoration-zinc-300 underline-offset-2"
          >
            {children}
          </Link>
        );
      }
      const capture = `/capture?title=${encodeURIComponent(target)}&garden=${garden}`;
      return (
        <Link
          href={capture}
          className="text-zinc-400 underline decoration-dotted decoration-zinc-300 underline-offset-2"
          title="Not yet written — tap to capture"
        >
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  const proseClass =
    "prose prose-zinc prose-sm max-w-none " +
    "prose-headings:font-semibold prose-headings:tracking-tight " +
    "prose-a:text-zinc-900 prose-a:underline prose-a:underline-offset-2 " +
    "prose-strong:font-semibold prose-strong:text-zinc-900 " +
    "prose-p:leading-relaxed prose-p:text-zinc-700 " +
    "prose-blockquote:border-zinc-300 prose-blockquote:text-zinc-500";

  const preRendered = preProse.trim()
    ? rewriteWikilinks(rewriteImageEmbeds(preProse, attachmentsBase))
    : "";
  const postRendered = postProse.trim()
    ? rewriteWikilinks(rewriteImageEmbeds(postProse, attachmentsBase))
    : "";

  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto">
        {/* Nav header */}
        <div className="flex items-center gap-4 px-4 py-4 sticky top-0 bg-zinc-50/90 backdrop-blur-sm z-10">
          <button
            onClick={() => router.back()}
            className="tap text-sm text-zinc-500 active:text-zinc-900"
            aria-label="Back"
          >
            ← Back
          </button>
          <span className="ml-auto text-xs tabular-nums text-zinc-400" aria-live="polite">
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved"
                : status === "error"
                  ? "Save failed"
                  : ""}
          </span>
          <Link href="/" className="tap text-sm text-zinc-500 active:text-zinc-900">
            Gardens
          </Link>
        </div>

        <article className="px-4 pb-24 flex flex-col gap-6">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900 leading-snug">
            {isFoundation && (
              <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" title="Foundation note" />
            )}
            {title}
          </h1>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          {preRendered && (
            <div className={proseClass}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={{ a: Anchor }}>
                {preRendered}
              </ReactMarkdown>
            </div>
          )}

          {/* Task list */}
          <div className="flex flex-col">
            <ul className="flex flex-col">
              {tasks.map((task) => (
                <TaskRow
                  key={task.lineIndex}
                  task={task}
                  onToggle={() => toggle(task.lineIndex)}
                  onEdit={(text) => editText(task.lineIndex, text)}
                  onDelete={() => remove(task.lineIndex)}
                />
              ))}
            </ul>

            <AddTaskRow onAdd={addTask} />

            {doneCount > 0 && (
              <button
                onClick={clearDone}
                className="tap self-start mt-3 text-xs text-zinc-400 active:text-zinc-700"
              >
                Clear {doneCount} done
              </button>
            )}
          </div>

          {postRendered && (
            <div className={proseClass}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={{ a: Anchor }}>
                {postRendered}
              </ReactMarkdown>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== task.text) onEdit(next);
    else setDraft(task.text);
  }

  return (
    <li className="group flex items-start gap-3 py-2.5 border-b border-zinc-100">
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={task.checked}
        aria-label={task.checked ? "Mark not done" : "Mark done"}
        className={`tap mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
          task.checked
            ? "bg-zinc-900 border-zinc-900 text-white"
            : "bg-white border-zinc-300 active:border-zinc-500"
        }`}
      >
        {task.checked && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(task.text);
              setEditing(false);
            }
          }}
          autoFocus
          className="flex-1 min-w-0 bg-transparent text-sm text-zinc-800 leading-snug focus:outline-none border-b border-zinc-300"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(task.text);
            setEditing(true);
          }}
          className={`flex-1 min-w-0 text-left text-sm leading-snug ${
            task.checked ? "text-zinc-400 line-through" : "text-zinc-800"
          }`}
        >
          {task.text || <span className="text-zinc-300">Empty task</span>}
        </button>
      )}

      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="tap shrink-0 text-zinc-300 active:text-red-500 text-lg leading-none -mt-0.5"
      >
        ×
      </button>
    </li>
  );
}

function AddTaskRow({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue(""); // keep focus for rapid entry
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-5 h-5 shrink-0 rounded-md border border-dashed border-zinc-300" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Add a task…"
        className="flex-1 min-w-0 bg-transparent text-sm text-zinc-800 leading-snug placeholder:text-zinc-400 focus:outline-none"
      />
    </div>
  );
}
