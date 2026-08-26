"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Card } from "@/lib/flashcards";
import type { Garden } from "@/lib/types";

interface DrawnCard {
  path: string;
  garden: Garden;
  noteName: string;
  noteTitle: string;
  card: Card;
}

// A floating "draw a random card" button that sits just above the app-wide
// capture (add-note) FAB. Unlike the review deck it ignores the SRS schedule —
// it surfaces any card from the current garden so you can quiz yourself on a
// whim. Opens a lightweight overlay: tap to reveal, draw again, or close.
export function RandomCardButton({ garden }: { garden: Garden }) {
  const [open, setOpen] = useState(false);
  const [drawn, setDrawn] = useState<DrawnCard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const draw = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRevealed(false);
    try {
      const r = await fetch(`/api/random-card?garden=${garden}`);
      const d = await r.json();
      if (d.error) {
        setError(d.error);
      } else if (!d.card) {
        setEmpty(true);
        setDrawn(null);
      } else {
        setEmpty(false);
        setDrawn(d.card as DrawnCard);
      }
    } catch {
      setError("Couldn't draw a card.");
    } finally {
      setLoading(false);
    }
  }, [garden]);

  const openDeck = useCallback(() => {
    setOpen(true);
    void draw();
  }, [draw]);

  const close = useCallback(() => {
    setOpen(false);
    setDrawn(null);
    setRevealed(false);
    setError(null);
    setEmpty(false);
  }, []);

  // Escape closes; space/enter reveals the current card.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (!revealed && drawn && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, revealed, drawn, close]);

  return (
    <>
      <button
        type="button"
        onClick={openDeck}
        aria-label="Draw a random card"
        className="fixed z-20 bottom-24 right-5 mb-safe w-14 h-14 rounded-full bg-white border border-zinc-200 text-zinc-700 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 3h5v5" />
          <path d="M4 20 21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-zinc-50 shadow-xl mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="text-sm font-semibold text-zinc-900">
                Random card
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="tap ml-auto text-zinc-400 active:text-zinc-900"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-4">
              {error ? (
                <p className="text-sm text-red-600 bg-red-50 rounded-2xl px-4 py-3">
                  {error}
                </p>
              ) : empty ? (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-500">
                    No cards in this garden yet.
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Add cards to any note with front :: back or {"{{cloze}}"}.
                  </p>
                </div>
              ) : (
                <>
                  {/* card */}
                  <button
                    type="button"
                    onClick={() => !revealed && setRevealed(true)}
                    className="tap w-full text-left rounded-3xl bg-white shadow-sm border border-zinc-100 px-5 py-8 min-h-[14rem] flex flex-col"
                  >
                    {loading || !drawn ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-zinc-400">Drawing…</p>
                      </div>
                    ) : (
                      <>
                        <div className="prose prose-zinc prose-sm max-w-none flex-1 flex items-center justify-center text-center">
                          <div className="w-full">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {drawn.card.front}
                            </ReactMarkdown>
                          </div>
                        </div>
                        {revealed && (
                          <>
                            <hr className="my-5 border-zinc-100" />
                            <div className="prose prose-zinc prose-sm max-w-none text-center">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {drawn.card.back}
                              </ReactMarkdown>
                            </div>
                          </>
                        )}
                        {!revealed && (
                          <p className="mt-auto pt-6 text-center text-xs text-zinc-300">
                            Tap or press space to reveal
                          </p>
                        )}
                      </>
                    )}
                  </button>

                  {/* source provenance */}
                  {drawn && (
                    <Link
                      href={`/garden/${drawn.garden}/${encodeURIComponent(drawn.noteName)}`}
                      className="tap text-center text-xs text-zinc-400 active:text-zinc-700"
                    >
                      {drawn.noteTitle} · {drawn.garden}
                    </Link>
                  )}

                  {/* draw another */}
                  <button
                    type="button"
                    onClick={() => void draw()}
                    disabled={loading}
                    className="tap rounded-2xl bg-zinc-900 text-white py-3.5 text-sm font-medium active:opacity-70 disabled:opacity-40"
                  >
                    Draw another
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
