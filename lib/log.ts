// Lightweight structured logging for server-side code. Output lands in the
// Vercel runtime logs (and your terminal under `next dev`). Errors/warns
// always print; set GARDEN_DEBUG=1 to also see info/debug chatter.
const DEBUG =
  process.env.GARDEN_DEBUG === "1" || process.env.GARDEN_DEBUG === "true";

type Meta = Record<string, unknown>;

function line(scope: string, message: string): string {
  return `[garden:${scope}] ${message}`;
}

export const log = {
  debug(scope: string, message: string, meta?: Meta) {
    if (DEBUG) console.log(line(scope, message), meta ?? "");
  },
  info(scope: string, message: string, meta?: Meta) {
    console.info(line(scope, message), meta ?? "");
  },
  warn(scope: string, message: string, meta?: Meta) {
    console.warn(line(scope, message), meta ?? "");
  },
  error(scope: string, message: string, meta?: Meta) {
    console.error(line(scope, message), meta ?? "");
  },
};

// Normalize any thrown value to a readable message.
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
