"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Garden } from "@/lib/types";

const GARDEN_LABELS: Record<Garden, string> = {
  priorities: "Priorities",
  ai: "AI",
  world: "World",
  culture: "Culture",
  misc: "Misc",
};

interface TopicMember {
  name: string;
  title: string;
}
interface Topic {
  kind: "cluster" | "thesis";
  key: string;
  label: string;
  members: TopicMember[];
  source: string;
}
interface Attempt {
  id: string;
  at: string;
  covered: string[];
  shaky: string[];
  missed: string[];
  feel?: number;
}

type Phase = "draw" | "dump" | "grade" | "done";
// Per-member self-grade. Unset until tapped; cycles covered → shaky → missed.
type Mark = "unset" | "covered" | "shaky" | "missed";

const MARK_CYCLE: Record<Mark, Mark> = {
  unset: "covered",
  covered: "shaky",
  shaky: "missed",
  missed: "unset",
};

// Keep the last few drawn topic keys out of the next draw (anti-repeat).
const RECENT_MAX = 4;

export function RecallSession({ garden }: { garden: Garden }) {
  const [phase, setPhase] = useState<Phase>("draw");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [emptyPool, setEmptyPool] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dump, setDump] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [freeGaps, setFreeGaps] = useState("");
  const [feel, setFeel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedGaps, setSavedGaps] = useState<TopicMember[]>([]);

  const recent = useRef<string[]>([]);
  const dumpRef = useRef<HTMLTextAreaElement>(null);

  const draw = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHistory([]);
    try {
      const r = await fetch(
        `/api/recall/topic?garden=${garden}&exclude=${recent.current.join(",")}`
      );
      const d = await r.json();
      if (d.error) {
        setError(d.error);
      } else if (!d.topic) {
        setEmptyPool(true);
        setTopic(null);
      } else {
        setEmptyPool(false);
        setTopic(d.topic as Topic);
        recent.current = [d.topic.key, ...recent.current].slice(0, RECENT_MAX);
        // Load this topic's past attempts (best-effort; failure just hides them).
        fetch(`/api/recall/log?garden=${garden}&topic=${encodeURIComponent(d.topic.key)}`)
          .then((res) => res.json())
          .then((j) => setHistory(Array.isArray(j.attempts) ? j.attempts : []))
          .catch(() => {});
      }
    } catch {
      setError("Couldn't draw a topic.");
    } finally {
      setLoading(false);
    }
  }, [garden]);

  useEffect(() => {
    void draw();
  }, [draw]);

  const startWriting = () => {
    setDump("");
    setMarks({});
    setFreeGaps("");
    setFeel(null);
    setSavedGaps([]);
    setPhase("dump");
  };

  useEffect(() => {
    if (phase === "dump") dumpRef.current?.focus();
  }, [phase]);

  const cycleMark = (name: string) =>
    setMarks((m) => ({ ...m, [name]: MARK_CYCLE[m[name] ?? "unset"] }));

  const save = async () => {
    if (!topic) return;
    setSaving(true);
    setError(null);
    const covered: string[] = [];
    const shaky: string[] = [];
    const missed: string[] = [];
    for (const mem of topic.members) {
      const mk = marks[mem.name] ?? "unset";
      if (mk === "covered") covered.push(mem.name);
      else if (mk === "shaky") shaky.push(mem.name);
      else if (mk === "missed") missed.push(mem.name);
    }
    try {
      const r = await fetch("/api/recall/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden,
          topicKey: topic.key,
          topic: topic.label,
          kind: topic.kind,
          dump,
          covered,
          shaky,
          missed,
          freeGaps,
          ...(feel ? { feel } : {}),
        }),
      });
      const d = await r.json();
      if (d.error) {
        setError(d.error);
      } else {
        // Gaps worth carding = everything shaky or missed, in note order.
        const gapNames = new Set([...shaky, ...missed]);
        setSavedGaps(topic.members.filter((m) => gapNames.has(m.name)));
        setPhase("done");
      }
    } catch {
      setError("Couldn't save your attempt.");
    } finally {
      setSaving(false);
    }
  };

  const verb = topic?.kind === "thesis" ? "Unpack this claim" : "Describe";

  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto flex min-h-svh flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 sticky top-0 bg-zinc-50/90 backdrop-blur-sm z-10">
          <Link
            href={`/garden/${garden}`}
            className="tap text-sm text-zinc-500 active:text-zinc-900"
          >
            ← {GARDEN_LABELS[garden]}
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900">Recall</h1>
        </div>

        {error && (
          <p className="mx-4 mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* DRAW */}
        {phase === "draw" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24 text-center">
            {loading ? (
              <p className="text-sm text-zinc-400">Drawing a topic…</p>
            ) : emptyPool ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-zinc-500">Nothing to recall here yet.</p>
                <p className="text-xs text-zinc-400">
                  Recall draws from your MOCs and{" "}
                  <code className="text-zinc-500">#framework/*</code> tags.
                </p>
              </div>
            ) : topic ? (
              <>
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {verb}
                  </span>
                  <span className="text-2xl font-semibold leading-snug text-zinc-900">
                    {topic.label}
                  </span>
                  <HistorySummary history={history} />
                </div>
                <div className="flex w-full max-w-xs flex-col gap-3">
                  <button
                    type="button"
                    onClick={startWriting}
                    className="tap rounded-2xl bg-zinc-900 py-3.5 text-sm font-medium text-white active:opacity-80"
                  >
                    Start writing
                  </button>
                  <button
                    type="button"
                    onClick={() => void draw()}
                    className="tap text-sm text-zinc-500 active:text-zinc-900"
                  >
                    Draw another
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* DUMP */}
        {phase === "dump" && topic && (
          <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {verb}
              </span>
              <span className="text-sm font-semibold text-zinc-900">{topic.label}</span>
            </div>
            <textarea
              ref={dumpRef}
              value={dump}
              onChange={(e) => setDump(e.target.value)}
              placeholder="Write everything you know. Don't peek at your notes."
              className="flex-1 min-h-[40svh] w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-900 outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={() => setPhase("grade")}
              className="tap rounded-2xl bg-zinc-900 py-3.5 text-sm font-medium text-white active:opacity-80"
            >
              Reveal &amp; grade
            </button>
          </div>
        )}

        {/* GRADE */}
        {phase === "grade" && topic && (
          <div className="flex flex-1 flex-col gap-4 px-4 pb-24">
            <p className="text-xs text-zinc-400">
              {topic.kind === "cluster"
                ? "Tap each note to mark how you did — covered, shaky, or missed."
                : "Open the note and compare. How did you do?"}
            </p>

            {topic.kind === "cluster" ? (
              <ul className="flex flex-col gap-2">
                {topic.members.map((mem) => {
                  const mk = marks[mem.name] ?? "unset";
                  return (
                    <li key={mem.name}>
                      <div className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-white p-3">
                        <button
                          type="button"
                          onClick={() => cycleMark(mem.name)}
                          className={`tap shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${MARK_STYLE[mk]}`}
                        >
                          {MARK_LABEL[mk]}
                        </button>
                        <Link
                          href={`/garden/${garden}/${encodeURIComponent(mem.name)}`}
                          target="_blank"
                          className="min-w-0 flex-1 truncate text-sm text-zinc-800 active:opacity-60"
                        >
                          {mem.title}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Link
                href={`/garden/${garden}/${encodeURIComponent(topic.members[0].name)}`}
                target="_blank"
                className="tap rounded-2xl border border-zinc-100 bg-white p-4 text-sm text-zinc-800 active:opacity-60"
              >
                Open “{topic.members[0].title}” →
              </Link>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">
                What couldn&apos;t you explain?
              </label>
              <textarea
                value={freeGaps}
                onChange={(e) => setFreeGaps(e.target.value)}
                placeholder="In your own words — the parts that were fuzzy or missing."
                className="min-h-[6rem] w-full resize-none rounded-2xl border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">How did that feel?</span>
              <div className="ml-auto flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeel(feel === n ? null : n)}
                    className={`tap h-8 w-8 rounded-full text-xs font-medium tabular-nums ${
                      feel === n
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-500 border border-zinc-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="tap mt-2 rounded-2xl bg-zinc-900 py-3.5 text-sm font-medium text-white active:opacity-80 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save attempt"}
            </button>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && topic && (
          <div className="flex flex-1 flex-col gap-6 px-4 pb-24 pt-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-sm font-semibold text-zinc-900">Attempt saved</span>
              <span className="text-xs text-zinc-400">{topic.label}</span>
            </div>

            {savedGaps.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-500">
                  Turn gaps into cards
                </p>
                <ul className="flex flex-col gap-2">
                  {savedGaps.map((gap) => (
                    <GapCard key={gap.name} garden={garden} gap={gap} />
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setPhase("draw");
                  void draw();
                }}
                className="tap rounded-2xl bg-zinc-900 py-3.5 text-sm font-medium text-white active:opacity-80"
              >
                Recall another
              </button>
              <Link
                href={`/garden/${garden}`}
                className="tap text-center text-sm text-zinc-500 active:text-zinc-900"
              >
                Back to {GARDEN_LABELS[garden]}
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Compact "you've done this before" line under a freshly drawn topic.
function HistorySummary({ history }: { history: Attempt[] }) {
  if (history.length === 0) return null;
  const last = history[0]; // log route returns newest first
  const marked = last.covered.length + last.shaky.length + last.missed.length;
  const when = new Date(last.at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <span className="text-xs text-zinc-400">
      Recalled {history.length}×
      {marked > 0 && ` · last ${last.covered.length}/${marked} covered`} · {when}
    </span>
  );
}

// One gap → an editable, prefilled card that appends to the source note.
function GapCard({ garden, gap }: { garden: Garden; gap: TopicMember }) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState(gap.title);
  const [back, setBack] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expand = async () => {
    setOpen(true);
    if (loaded) return;
    try {
      const r = await fetch(
        `/api/recall/card?garden=${garden}&note=${encodeURIComponent(gap.name)}`
      );
      const d = await r.json();
      if (!d.error) {
        setFront(d.front || gap.title);
        setBack(d.back || "");
      }
    } catch {
      /* keep the title-only default */
    } finally {
      setLoaded(true);
    }
  };

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/recall/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garden, note: gap.name, front, back }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setAdded(true);
    } catch {
      setError("Couldn't add the card.");
    } finally {
      setBusy(false);
    }
  };

  if (added) {
    return (
      <li className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
        <span className="text-xs font-medium text-emerald-700">✓ added</span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{gap.title}</span>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-zinc-100 bg-white p-3">
      {!open ? (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{gap.title}</span>
          <button
            type="button"
            onClick={() => void expand()}
            className="tap shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white active:opacity-80"
          >
            ＋ card
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Front (prompt)"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder={loaded ? "Back (answer)" : "Loading…"}
            className="min-h-[3.5rem] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !front.trim() || !back.trim()}
              className="tap flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white active:opacity-80 disabled:opacity-40"
            >
              {busy ? "Adding…" : "Add to deck"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tap rounded-xl px-3 py-2 text-xs text-zinc-500 active:text-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

const MARK_STYLE: Record<Mark, string> = {
  unset: "bg-zinc-100 text-zinc-500",
  covered: "bg-emerald-100 text-emerald-700",
  shaky: "bg-amber-100 text-amber-700",
  missed: "bg-red-100 text-red-700",
};
const MARK_LABEL: Record<Mark, string> = {
  unset: "· mark ·",
  covered: "covered",
  shaky: "shaky",
  missed: "missed",
};
