import { MissedQuestionsSection } from "@/features/exams/missed-questions-section";
import { getStudentMissedReview } from "@/lib/exams/missed-review-server";

/** Dedicated student-owned review page; not mixed into exam history. */
export default async function MissedQuestionsPage() {
  const review = await getStudentMissedReview(100);
  return <main className="mx-auto max-w-6xl">
    <MissedQuestionsSection review={review} />
  </main>;
}
