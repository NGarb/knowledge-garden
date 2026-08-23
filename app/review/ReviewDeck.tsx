"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Card, Grade } from "@/lib/flashcards";
import type { Garden } from "@/lib/types";

interface DueCard {
  path: string;
  garden: Garden;
  noteName: string;
  noteTitle: string;
  card: Card;
}

const GRADES: { grade: Grade; label: string; key: string; className: string }[] = [
  { grade: "again", label: "Again", key: "1", className: "bg-red-50 text-red-700 active:bg-red-100" },
  { grade: "hard", label: "Hard", key: "2", className: "bg-amber-50 text-amber-700 active:bg-amber-100" },
  { grade: "good", label: "Good", key: "3", className: "bg-emerald-50 text-emerald-700 active:bg-emerald-100" },
  { grade: "easy", label: "Easy", key: "4", className: "bg-sky-50 text-sky-700 active:bg-sky-100" },
];

export function ReviewDeck() {
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.error) setError(d.error);
        else setQueue(d.due as DueCard[]);
      })
      .catch(() => live && setError("Couldn't load your cards."));
    return () => {
      live = false;
    };
  }, []);

  const current = queue?.[pos] ?? null;

  const grade = useCallback(
    (g: Grade) => {
      if (!current || !queue) return;
      const graded = current;
      // Advance the UI immediately; the save rides along in the background so
      // reviewing stays snappy even on a slow connection.
      fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: graded.path,
          content: graded.card.content,
          grade: g,
        }),
      }).catch(() => {});

      setReviewed((n) => n + 1);
      setRevealed(false);
      // "Again" re-queues the card at the end of this session.
      if (g === "again") {
        setQueue((q) => (q ? [...q, graded] : q));
      }
      setPos((p) => p + 1);
    },
    [current, queue]
  );

  // Keyboard: space/enter flips, 1–4 grade.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const hit = GRADES.find((g) => g.key === e.key);
        if (hit) {
          e.preventDefault();
          grade(hit.grade);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, grade]);

  // --- states ---------------------------------------------------------------

  if (error) {
    return (
      <Shell>
        <p className="text-sm text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>
      </Shell>
    );
  }

  if (queue === null) {
    return (
      <Shell>
        <p className="text-sm text-zinc-400">Loading cards…</p>
      </Shell>
    );
  }

  if (!current) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center py-16">
          <div className="text-4xl">✓</div>
          <h2 className="text-lg font-semibold text-zinc-900">
            {reviewed > 0 ? "All done for today" : "Nothing due"}
          </h2>
          <p className="text-sm text-zinc-500">
            {reviewed > 0
              ? `${reviewed} card${reviewed === 1 ? "" : "s"} reviewed.`
              : "Add cards to any note with front :: back or {{cloze}}."}
          </p>
          <Link
            href="/"
            className="tap mt-2 rounded-full bg-zinc-900 text-white text-sm px-5 py-2.5 active:opacity-70"
          >
            Back to gardens
          </Link>
        </div>
      </Shell>
    );
  }

  const remaining = queue.length - pos;

  return (
    <Shell>
      {/* progress */}
      <div className="flex items-center justify-between text-xs text-zinc-400 tabular-nums px-1">
        <span>{remaining} left</span>
        <span>{reviewed} done</span>
      </div>

      {/* card */}
      <button
        onClick={() => !revealed && setRevealed(true)}
        className="tap w-full text-left rounded-3xl bg-white shadow-sm border border-zinc-100 px-5 py-8 min-h-[16rem] flex flex-col"
      >
        <div className="prose prose-zinc prose-sm max-w-none flex-1 flex items-center justify-center text-center">
          <div className="w-full">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {current.card.front}
            </ReactMarkdown>
          </div>
        </div>

        {revealed && (
          <>
            <hr className="my-5 border-zinc-100" />
            <div className="prose prose-zinc prose-sm max-w-none text-center">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {current.card.back}
              </ReactMarkdown>
            </div>
          </>
        )}

        {!revealed && (
          <p className="mt-auto pt-6 text-center text-xs text-zinc-300">
            Tap or press space to reveal
          </p>
        )}
      </button>

      {/* source provenance */}
      <Link
        href={`/garden/${current.garden}/${encodeURIComponent(current.noteName)}`}
        className="tap text-center text-xs text-zinc-400 active:text-zinc-700"
      >
        {current.noteTitle} · {current.garden}
      </Link>

      {/* grade buttons */}
      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              onClick={() => grade(g.grade)}
              className={`tap rounded-2xl py-3 text-sm font-medium ${g.className}`}
            >
              {g.label}
              <span className="block text-[10px] opacity-50">{g.key}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="tap rounded-2xl bg-zinc-900 text-white py-3.5 text-sm font-medium active:opacity-70"
        >
          Reveal
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center gap-4 py-4">
          <Link href="/" className="tap text-sm text-zinc-500 active:text-zinc-900">
            ← Gardens
          </Link>
          <span className="ml-auto text-sm font-medium text-zinc-900">Review</span>
        </div>
        <div className="flex flex-col gap-4 pb-24">{children}</div>
      </div>
    </main>
  );
}
