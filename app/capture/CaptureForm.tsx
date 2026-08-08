"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Garden } from "@/lib/types";

const GARDENS: { id: Garden; label: string }[] = [
  { id: "ai", label: "AI" },
  { id: "world", label: "World" },
  { id: "culture", label: "Culture" },
  { id: "misc", label: "Misc" },
];

interface Props {
  initialTitle: string;
  initialGarden: Garden | null;
}

export function CaptureForm({ initialTitle, initialGarden }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [garden, setGarden] = useState<Garden | null>(initialGarden);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && garden !== null && status === "idle";

  async function submit() {
    if (!canSubmit) return;
    setStatus("saving");
    setError(null);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body, garden }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("idle");
        return;
      }

      setStatus("done");
      // Land on the freshly created note.
      router.push(data.route);
    } catch {
      setError("Network error — check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50 pt-safe">
      <div className="max-w-lg mx-auto flex flex-col min-h-svh">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 sticky top-0 bg-zinc-50/90 backdrop-blur-sm z-10">
          <button
            onClick={() => router.back()}
            className="text-sm text-zinc-500 active:text-zinc-900"
          >
            Cancel
          </button>
          <h1 className="text-lg font-semibold text-zinc-900">Capture</h1>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="ml-auto text-sm font-medium text-zinc-900 disabled:text-zinc-300 active:opacity-60"
          >
            {status === "saving" ? "Saving…" : status === "done" ? "Saved" : "Save"}
          </button>
        </div>

        <div className="flex flex-col gap-5 px-4 py-2">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus={!initialTitle}
            className="w-full bg-transparent text-xl font-semibold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none"
          />

          {/* Garden picker */}
          <div className="flex flex-wrap gap-2">
            {GARDENS.map((g) => {
              const active = garden === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGarden(g.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-500 border border-zinc-200 active:bg-zinc-100"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your note… [[wikilinks]] welcome."
            rows={12}
            className="w-full bg-transparent text-base text-zinc-700 leading-relaxed placeholder:text-zinc-300 focus:outline-none resize-none"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
