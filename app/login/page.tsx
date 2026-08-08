"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const params = useSearchParams();
  const error = params.get("error");
  const from = params.get("from") || "/";

  return (
    <form action="/api/auth" method="POST" className="flex flex-col gap-4 w-full">
      <input type="hidden" name="from" value={from} />
      <input
        type="password"
        name="password"
        placeholder="Password"
        autoFocus
        autoComplete="current-password"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      {error && (
        <p className="text-sm text-red-500 text-center">Incorrect password</p>
      )}
      <button
        type="submit"
        className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-base font-medium text-white active:bg-zinc-700"
      >
        Enter garden
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 pb-safe">
      <div className="w-full max-w-xs flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Garden</h1>
          <p className="text-sm text-zinc-500">Your private Zettelkasten</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
