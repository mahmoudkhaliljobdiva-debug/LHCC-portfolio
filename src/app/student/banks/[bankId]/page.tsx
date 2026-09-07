import Link from "next/link";
import { getStudentCourse } from "@/lib/bank-access/server";
import { CourseQuestions } from "@/features/question-banks/course-questions";
export default async function CoursePage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  const course = await getStudentCourse(bankId);
  if (!course) return <section className="rounded-2xl border bg-white p-6"><h1 className="text-xl font-semibold text-slate-950">You don&apos;t have access to this course.</h1><p className="mt-3 text-sm text-slate-600">Request access from the course catalog. An administrator must approve your request.</p><Link href="/student/question-banks" className="mt-5 inline-block font-semibold text-teal-700 dark:text-teal-200">Browse question banks</Link></section>;
  return <><Link href="/student/question-banks" className="text-sm font-semibold text-teal-700 dark:text-teal-200">Back to question banks</Link><h1 className="mt-5 text-2xl font-semibold text-slate-950">{course.bank.name}</h1><p className="mt-2 mb-7 text-sm text-slate-500">{course.bank.description}</p><CourseQuestions questions={course.questions} /></>;
}
