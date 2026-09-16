import { NextResponse } from "next/server";
import { loadRecallNotes } from "@/lib/recall-io";
import { buildTopicPool, drawTopic } from "@/lib/recall";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["priorities", "ai", "world", "culture", "misc"];

// GET /api/recall/topic?garden=world&exclude=key1,key2
// Draw one topic to recall — a curated cluster, occasionally a thesis — avoiding
// the recently-served keys the client passes back.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const garden = url.searchParams.get("garden") ?? "";
  if (!VALID_GARDENS.includes(garden as Garden)) {
    return NextResponse.json({ error: "Unknown garden." }, { status: 400 });
  }
  const exclude = (url.searchParams.get("exclude") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const notes = await loadRecallNotes(garden as Garden);
    const pool = buildTopicPool(notes, garden);
    const topic = drawTopic(pool, { exclude });
    if (!topic) {
      return NextResponse.json({ topic: null, poolSize: 0 });
    }
    return NextResponse.json({ topic, poolSize: pool.length });
  } catch (e) {
    log.error("recall", `topic draw failed for "${garden}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to draw a topic." }, { status: 500 });
  }
}
