import { notFound, redirect } from "next/navigation";
import { sourceKindSchema } from "@/features/exams/missed-review-types";

/** Backward-compatible redirect for links shared before the sidebar move. */
export default async function LegacyQuestionReview({
  params, searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { questionId } = await params;
  const { source } = await searchParams;
  if (!questionId || questionId.length > 200 || !sourceKindSchema.safeParse(source).success) notFound();
  redirect(`/student/missed-questions/review/${encodeURIComponent(questionId)}?source=${source}`);
}
