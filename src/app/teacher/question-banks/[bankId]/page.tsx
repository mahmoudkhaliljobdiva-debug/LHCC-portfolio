import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeacherBank } from "@/lib/teacher/server";
import { TeacherBankView } from "@/features/question-banks/teacher-bank-view";

export default async function TeacherBankPage({ params }: { readonly params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  const course = await getTeacherBank(bankId);
  if (!course) notFound();
  return <><Link href="/teacher/question-banks" className="mb-6 inline-flex text-sm font-semibold text-teal-700">Back to assigned banks</Link><TeacherBankView course={course} /></>;
}
