import { ReviewDeck } from "./ReviewDeck";

// The deck loads its due cards client-side from /api/review so grading can
// write back without a full page reload.
export const dynamic = "force-dynamic";

export default function ReviewPage() {
  return <ReviewDeck />;
}
