import { NextResponse } from "next/server";
import { appendAttempt, type RecallAttempt } from "@/lib/recall-io";
import { log, errMessage } from "@/lib/log";
import type { Garden } from "@/lib/types";

const VALID_GARDENS: Garden[] = ["priorities", "ai", "world", "culture", "misc"];

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

// POST /api/recall/attempt  { garden, topicKey, topic, kind, dump, covered,
//   missed, shaky, freeGaps, feel? } → append the attempt to recall/<garden>.json
export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const garden = payload.garden as Garden;
  if (!VALID_GARDENS.includes(garden)) {
    return NextResponse.json({ error: "Unknown garden." }, { status: 400 });
  }
  const topic = String(payload.topic ?? "").trim();
  const topicKey = String(payload.topicKey ?? "").trim();
  const kind = payload.kind === "thesis" ? "thesis" : "cluster";
  if (!topic || !topicKey) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }

  const feelRaw = Number(payload.feel);
  const attempt: RecallAttempt = {
    id: crypto.randomUUID(),
    topicKey,
    topic,
    kind,
    at: new Date().toISOString(),
    dump: String(payload.dump ?? ""),
    covered: strArray(payload.covered),
    missed: strArray(payload.missed),
    shaky: strArray(payload.shaky),
    freeGaps: String(payload.freeGaps ?? ""),
    ...(feelRaw >= 1 && feelRaw <= 5 ? { feel: Math.round(feelRaw) } : {}),
  };

  try {
    await appendAttempt(garden, attempt);
  } catch (e) {
    log.error("recall", `attempt save failed for "${garden}": ${errMessage(e)}`);
    return NextResponse.json({ error: "Failed to save attempt." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: attempt.id });
}
