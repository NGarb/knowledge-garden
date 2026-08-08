import type { Garden } from "@/lib/types";
import { CaptureForm } from "./CaptureForm";

const VALID_GARDENS = ["ai", "world", "culture", "misc"] as const;

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; garden?: string }>;
}) {
  const sp = await searchParams;
  const initialTitle = sp.title ?? "";
  const initialGarden = VALID_GARDENS.includes(sp.garden as Garden)
    ? (sp.garden as Garden)
    : null;

  return (
    <CaptureForm initialTitle={initialTitle} initialGarden={initialGarden} />
  );
}
