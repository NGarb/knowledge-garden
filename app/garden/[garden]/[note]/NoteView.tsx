"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentPropsWithoutRef } from "react";
import type { Garden, NoteFrontmatter } from "@/lib/types";

interface Props {
  title: string;
  garden: Garden;
  body: string;
  frontmatter: NoteFrontmatter;
  isFoundation: boolean;
  // normalized note name -> route, for live wikilinks
  linkMap: Record<string, string>;
  // repo folder holding this note's image attachments, e.g. "misc/attachments"
  attachmentsBase: string;
}

const WIKILINK_SCHEME = "wikilink:";

// Rewrite Obsidian image embeds ![[file.png]] / ![[file.png|alt]] into standard
// markdown images pointing at our attachment API. Runs before the wikilink
// rewrite so the leading "!" isn't stranded on a plain link. Only touches
// embeds whose target has an image extension; other embeds fall through.
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

// Rewrite [[Target]] / [[Target|Alias]] into markdown links carrying the
// target in a custom scheme, so ReactMarkdown parses them and hands them to
// our anchor renderer. Escapes any real link syntax inside the alias.
function rewriteWikilinks(body: string): string {
  return body.replace(
    /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (_, target: string, alias?: string) => {
      const label = (alias ?? target).trim().replace(/[[\]]/g, "");
      return `[${label}](${WIKILINK_SCHEME}${encodeURIComponent(target.trim())})`;
    }
  );
}

export function NoteView({
  title,
  garden,
  body,
  frontmatter,
  isFoundation,
  linkMap,
  attachmentsBase,
}: Props) {
  const router = useRouter();
  const [fmOpen, setFmOpen] = useState(false);

  const rendered = useMemo(
    () => rewriteWikilinks(rewriteImageEmbeds(body, attachmentsBase)),
    [body, attachmentsBase]
  );

  const metaFields = [
    frontmatter.type && { label: "Type", value: frontmatter.type },
    frontmatter.category && { label: "Category", value: frontmatter.category },
    frontmatter.garden && { label: "Garden", value: frontmatter.garden },
    frontmatter.captured && {
      label: "Captured",
      value: new Date(frontmatter.captured).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    },
    frontmatter.tags?.length && {
      label: "Tags",
      value: (frontmatter.tags as string[]).join(", "),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  // Custom anchor renderer: intercept wikilinks, leave normal links alone.
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

      // Dead link — open capture pre-filled with the target title.
      const capture = `/capture?title=${encodeURIComponent(
        target
      )}&garden=${garden}`;
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
          <Link
            href="/"
            className="tap ml-auto text-sm text-zinc-500 active:text-zinc-900"
          >
            Gardens
          </Link>
        </div>

        <article className="px-4 pb-24 flex flex-col gap-6">
          {/* Title + foundation marker */}
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900 leading-snug">
            {isFoundation && (
              <span
                className="w-2 h-2 rounded-full bg-zinc-900 shrink-0"
                title="Foundation note"
              />
            )}
            {title}
          </h1>

          {/* Frontmatter toggle */}
          {metaFields.length > 0 && (
            <div className="rounded-2xl bg-white border border-zinc-100 overflow-hidden">
              <button
                onClick={() => setFmOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-500 active:bg-zinc-50"
              >
                <span>Metadata</span>
                <span className="text-zinc-300">{fmOpen ? "▲" : "▼"}</span>
              </button>
              {fmOpen && (
                <dl className="divide-y divide-zinc-100 border-t border-zinc-100">
                  {metaFields.map(({ label, value }) => (
                    <div key={label} className="flex px-4 py-2.5 gap-4">
                      <dt className="text-xs text-zinc-400 w-20 shrink-0 pt-0.5">
                        {label}
                      </dt>
                      <dd className="text-sm text-zinc-700">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {/* Body */}
          <div className="prose prose-zinc prose-sm max-w-none
            prose-headings:font-semibold prose-headings:tracking-tight
            prose-a:text-zinc-900 prose-a:underline prose-a:underline-offset-2
            prose-strong:font-semibold prose-strong:text-zinc-900
            prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2
            prose-p:leading-relaxed prose-p:text-zinc-700
            prose-blockquote:border-zinc-300 prose-blockquote:text-zinc-500">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ a: Anchor }}
            >
              {rendered}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </main>
  );
}
