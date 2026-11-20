import Link from "next/link";
import { getExamBank } from "@/lib/exams/server";
import { ExamBankDetails } from "@/features/exams/bank-details";
export default async function CoursePage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  const course = await getExamBank(bankId);
  if (!course) return <section className="rounded-2xl border bg-white p-6"><h1 className="text-xl font-semibold text-slate-950">You don&apos;t have access to this course.</h1><p className="mt-3 text-sm text-slate-600">Request access from the course catalog. An administrator must approve your request.</p><Link href="/student/question-banks" className="mt-5 inline-block font-semibold text-teal-700 dark:text-teal-200">Browse question banks</Link></section>;
  return <><Link href="/student/question-banks" className="mb-5 inline-block text-sm font-semibold text-teal-700 dark:text-teal-200">Back to question banks</Link><ExamBankDetails bank={course} /></>;
}
