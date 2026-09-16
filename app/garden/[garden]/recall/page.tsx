import { notFound } from "next/navigation";
import { RecallSession } from "./RecallSession";
import type { Garden } from "@/lib/types";

const VALID_GARDENS = ["priorities", "ai", "world", "culture", "misc"] as const;

// The recall loop loads its topic client-side (draw → dump → grade) so writing
// never triggers a navigation that could lose the dump.
export const dynamic = "force-dynamic";

export default async function RecallPage({
  params,
}: {
  params: Promise<{ garden: string }>;
}) {
  const { garden } = await params;
  if (!VALID_GARDENS.includes(garden as Garden)) notFound();
  return <RecallSession garden={garden as Garden} />;
}
