"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Garden } from "@/lib/types";

interface Hit {
  garden: Garden;
  name: string;
  title: string;
  snippet: string;
  foundation: boolean;
}
interface Group {
  garden: Garden;
  hits: Hit[];
}

const GARDEN_LABELS: Record<Garden, string> = {
  ai: "AI",
  world: "World",
  culture: "Culture",
  misc: "Misc",
};

// Split text on the query (case-insensitive) and wrap matches in <mark>.
function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  while (i <= text.length) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark
        key={idx}
        className="bg-yellow-200/70 text-inherit rounded-sm px-0.5"
      >
        {text.slice(idx, idx + ql.length)}
      </mark>
    );
    i = idx + ql.length;
  }
  return out;
}

type Status = "idle" | "loading" | "done";

export function SearchClient() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced fetch on query change.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setGroups([]);
      setStatus("idle");
      setError(null);
      return;
    }

    setStatus("loading");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Search failed.");
          setGroups([]);
        } else {
          setGroups(data.groups ?? []);
          setError(null);
        }
        setStatus("done");
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("Network error.");
          setStatus("done");
        }
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const total = groups.reduce((n, g) => n + g.hits.length, 0);

  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto">
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 sticky top-0 bg-zinc-50/90 backdrop-blur-sm z-10">
          <button
            onClick={() => router.back()}
            className="tap text-sm text-zinc-500 active:text-zinc-900 shrink-0"
          >
            ← Back
          </button>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all gardens…"
            className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 focus:outline-none focus:border-zinc-300"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        <div className="px-4 pb-24">
          {status === "idle" && (
            <p className="py-16 text-center text-sm text-zinc-400">
              Search titles and content across every garden.
            </p>
          )}

          {status === "loading" && (
            <p className="py-16 text-center text-sm text-zinc-400">Searching…</p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {status === "done" && !error && total === 0 && (
            <p className="py-16 text-center text-sm text-zinc-400">
              No matches for “{q.trim()}”.
            </p>
          )}

          {status === "done" && total > 0 && (
            <div className="flex flex-col gap-6 pt-2">
              {groups.map((group) => (
                <section key={group.garden}>
                  <h2 className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {GARDEN_LABELS[group.garden]}
                    <span className="ml-1.5 tabular-nums">{group.hits.length}</span>
                  </h2>
                  <ul className="flex flex-col divide-y divide-zinc-100">
                    {group.hits.map((hit) => (
                      <li key={`${hit.garden}/${hit.name}`}>
                        <Link
                          href={`/garden/${hit.garden}/${encodeURIComponent(
                            hit.name
                          )}`}
                          className="flex flex-col gap-1 py-3 active:opacity-60"
                        >
                          <div className="flex items-center gap-2">
                            {hit.foundation && (
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0" />
                            )}
                            <span className="text-sm font-medium text-zinc-900 leading-snug">
                              {highlight(hit.title, q.trim())}
                            </span>
                          </div>
                          {hit.snippet && (
                            <p className="text-sm text-zinc-500 leading-snug line-clamp-2">
                              {highlight(hit.snippet, q.trim())}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
