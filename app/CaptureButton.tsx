"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Floating capture button, mounted app-wide. Hidden on the capture sheet
// itself and the login screen.
export function CaptureButton() {
  const pathname = usePathname();

  if (pathname === "/capture" || pathname === "/login") return null;

  // If we're inside a garden, pre-select it in the capture picker.
  const match = pathname.match(/^\/garden\/([^/]+)/);
  const href = match ? `/capture?garden=${match[1]}` : "/capture";

  return (
    <Link
      href={href}
      aria-label="Capture a note"
      className="fixed z-20 bottom-6 right-5 mb-safe w-14 h-14 rounded-full bg-zinc-900 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </Link>
  );
}
