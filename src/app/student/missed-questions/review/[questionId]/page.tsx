import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getStudentMissedReview } from "@/lib/exams/missed-review-server";
import { sourceKindSchema } from "@/features/exams/missed-review-types";
import { MissedQuestionDetail } from "@/features/exams/missed-question-detail";

export default async function StudentQuestionReviewPage({
  params, searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { questionId } = await params;
  const { source } = await searchParams;
  if (!questionId || questionId.length > 200) notFound();
  const parsedSource = sourceKindSchema.safeParse(source);
  if (!parsedSource.success) notFound();
  const data = await getStudentMissedReview(1, questionId, parsedSource.data);
  const question = data.questions.find(item => item.questionId===questionId && item.sourceKind===parsedSource.data);
  if (!question) notFound();
  return <main className="mx-auto max-w-3xl space-y-5">
    <Link href="/student/missed-questions#most-missed-questions" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50"><ArrowLeft className="size-4" aria-hidden="true" />Back to Missed Questions</Link>
    <article className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
      <h1 className="mb-5 border-b pb-4 text-xl font-bold text-slate-950">Your question review</h1>
      <MissedQuestionDetail question={question} />
    </article>
  </main>;
}
