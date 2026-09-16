import { NextResponse } from "next/server";
import { readLog } from "@/lib/recall-io";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["priorities", "ai", "world", "culture", "misc"];

// GET /api/recall/log?garden=world[&topic=<key>]
// Past recall attempts for a garden, newest first. Optionally filtered to one
// topic key.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const garden = url.searchParams.get("garden") ?? "";
  if (!VALID_GARDENS.includes(garden as Garden)) {
    return NextResponse.json({ error: "Unknown garden." }, { status: 400 });
  }
  const topicKey = url.searchParams.get("topic");

  try {
    const { attempts } = await readLog(garden as Garden);
    const filtered = topicKey
      ? attempts.filter((a) => a.topicKey === topicKey)
      : attempts;
    // Newest first for display.
    return NextResponse.json({ attempts: filtered.slice().reverse() });
  } catch (e) {
    log.error("recall", `log read failed for "${garden}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to load history." }, { status: 500 });
  }
}
