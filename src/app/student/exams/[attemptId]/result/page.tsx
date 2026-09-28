import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { getExamAttempt } from "@/lib/exams/server";
import { ExamResult } from "@/features/exams/exam-result";
export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params; const exam = await getExamAttempt(attemptId);
  if (!exam || exam.status === "ABANDONED") notFound();
  if (exam.status !== "COMPLETED") redirect(`/student/exams/${exam.id}` as Route);
  return <ExamResult exam={exam} />;
}
