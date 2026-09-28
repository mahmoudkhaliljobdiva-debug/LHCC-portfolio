import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { getExamAttempt } from "@/lib/exams/server";
import { ExamForm } from "@/features/exams/exam-form";
export default async function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params; const exam = await getExamAttempt(attemptId);
  if (!exam || exam.status === "ABANDONED") notFound();
  if (exam.status === "COMPLETED") redirect(`/student/exams/${exam.id}/result` as Route);
  return <ExamForm key={exam.id} exam={exam} />;
}
