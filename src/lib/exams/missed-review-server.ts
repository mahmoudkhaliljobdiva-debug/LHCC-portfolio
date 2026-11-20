import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { missedReviewSchema, sourceKindSchema } from "@/features/exams/missed-review-types";
import type { MissedReview, SourceKind } from "@/features/exams/missed-review-types";

/** Student-owned, completed attempts only. Answer keys are read from the
 * immutable attempt solution snapshots, never from active/draft question banks.
 */
export async function getStudentMissedReview(
  limit = 60,
  questionId?: string,
  sourceKind?: SourceKind,
): Promise<MissedReview> {
  await requireRole("STUDENT");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid review limit.");
  if (questionId && (questionId.length > 200 || questionId.length === 0)) throw new Error("Invalid question ID.");
  if (sourceKind && !sourceKindSchema.safeParse(sourceKind).success) throw new Error("Invalid source type.");
  const db = await createClient();
  const { data, error } = await db.rpc("student_missed_question_review", {
    max_questions: limit,
    filter_question_id: questionId ?? null,
    filter_source_kind: sourceKind ?? null,
  });
  if (error) throw new Error("Unable to load your missed question review.");
  return missedReviewSchema.parse(data);
}
