"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Home-screen entry to the review deck, with a live "due today" badge fetched
// from /api/review so the number is always current without slowing the page's
// server render.
export function ReviewLink() {
  const [due, setDue] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/review?count=1")
      .then((r) => r.json())
      .then((d) => live && typeof d.due === "number" && setDue(d.due))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <Link
      href="/review"
      className="flex items-center gap-2 rounded-full bg-white border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 active:bg-zinc-50"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-zinc-400"
      >
        <rect x="3" y="4" width="14" height="16" rx="2" />
        <path d="M7 4v16" />
        <path d="m17 8 4 1.5L17 20" />
      </svg>
      Review flashcards
      {due !== null && due > 0 && (
        <span className="ml-auto rounded-full bg-zinc-900 text-white text-xs font-medium px-2 py-0.5 tabular-nums">
          {due} due
        </span>
      )}
      {due === 0 && <span className="ml-auto text-xs text-zinc-300">all caught up</span>}
    </Link>
  );
}
