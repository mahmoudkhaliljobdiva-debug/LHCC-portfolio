import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningCatalog } from "@/lib/learning/server";
import { getStudentCoursePackages } from "@/lib/bank-access/server";
import { SpecialtyIcon } from "@/components/ui/specialty-icon";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { CoursePackageGrid } from "@/features/question-banks/course-package-grid";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const {slug}=await params;
  const [catalog,packages]=await Promise.all([getLearningCatalog(),getStudentCoursePackages()]);
  const specialty=catalog.find(s=>s.slug===slug);
  const pkg=packages.find(item=>item.slug===slug);
  if (!specialty || !pkg) notFound();
  return <div className="space-y-6"><Link href="/student" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">Back to your learning</Link><header><span className="inline-flex rounded-2xl bg-teal-50 p-4 text-teal-700"><SpecialtyIcon icon={specialty.icon} className="size-14"/></span><h1 dir="auto" className="mt-4 break-words text-3xl font-semibold text-slate-950">{pkg.name}</h1>{specialty.description && <p dir="auto" className="mt-3 break-words text-slate-600">{specialty.description}</p>}</header>{pkg.accessState === "APPROVED" ? <QuestionBankGrid banks={pkg.materials}/> : <CoursePackageGrid packages={[pkg]} expanded/>}</div>;
}
