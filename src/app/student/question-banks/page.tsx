import Link from "next/link";
import type { Route } from "next";
import { BookOpenCheck, ArrowRight } from "lucide-react";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { getStudentBanks } from "@/lib/bank-access/server";
import { getLearningCatalog } from "@/lib/learning/server";

export default async function StudentBanksPage() {
  const [banks, catalog] = await Promise.all([getStudentBanks(), getLearningCatalog()]);
  const medical = catalog.find(item => item.slug === "medical");
  const subjects = medical?.materials.filter(item => item.materialKind === "SUBJECT") ?? [];
  return <div className="space-y-9">
    <section aria-labelledby="exam-courses-title">
      <div className="mb-6">
        <h1 id="exam-courses-title" className="text-2xl font-semibold text-slate-950 sm:text-3xl">My Courses</h1>
        <p className="mt-2 text-sm text-slate-600">Open published exam tracks or request access to a course.</p>
      </div>
      <QuestionBankGrid banks={banks} />
    </section>
    {subjects.length > 0 && <section aria-labelledby="medical-subjects-title">
      <div className="mb-5">
        <div className="flex items-center gap-2 text-teal-700"><BookOpenCheck aria-hidden="true" className="size-5"/><span className="text-xs font-bold uppercase tracking-wide">Medicine</span></div>
        <h2 id="medical-subjects-title" className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">Medical Subjects</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Read questions extracted from subject PDFs. These are ungraded study previews while their answer keys await editorial review.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{subjects.map(subject =>
        <Link key={subject.id} href={`/student/medical/${subject.id}` as Route}
          className="lhcc-card-stack rounded-2xl border bg-white p-5 shadow-sm transition-[border-color,box-shadow] hover:border-teal-500 hover:shadow-md sm:p-6">
          <BookOpenCheck className="size-7 text-teal-700" aria-hidden="true" />
          <h3 dir="auto" className="mt-4 break-words text-lg font-semibold text-slate-950">{subject.name}</h3>
          <p className="mt-2 text-sm text-slate-600">Source-extracted questions · answers pending review</p>
          <span className="lhcc-card-footer inline-flex items-center gap-2 text-sm font-semibold text-teal-700">Study questions <ArrowRight className="size-4" aria-hidden="true"/></span>
        </Link>)}</div>
    </section>}
  </div>;
}
