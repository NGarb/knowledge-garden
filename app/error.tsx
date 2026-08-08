"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[garden:boundary]", error);
  }, [error]);

  return (
    <main className="min-h-svh bg-zinc-50 flex items-center justify-center px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-4 text-center">
        <h1 className="text-lg font-semibold text-zinc-900">
          Something went wrong
        </h1>
        <p className="text-sm text-zinc-500 break-words">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-xs text-zinc-400">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-2 px-5 py-2 rounded-full bg-zinc-900 text-white text-sm font-medium active:opacity-70"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
