import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { groupLearningMaterials } from "@/lib/learning/material-groups";
import type { LearningCatalog } from "@/types/learning-catalog";
import type { StudentBank } from "@/types/bank-access";

export function SpecialtyMaterials({ materials, banks }: {
  readonly materials: LearningCatalog[number]["materials"];
  readonly banks?: StudentBank[];
}) {
  const groups = groupLearningMaterials(materials);
  if (!groups.length) return <p className="rounded-2xl border border-dashed bg-white p-6 text-slate-600">No materials published yet.</p>;
  return <div className="space-y-8">{groups.map(group => <section key={group.key} aria-labelledby={`materials-${group.key}`}>
    <h2 id={`materials-${group.key}`} className="text-xl font-semibold text-slate-950">{group.title}</h2>
    <div className="mt-4">{banks && group.key !== "SUBJECT"
      ? <QuestionBankGrid banks={banks.filter(bank => group.materials.some(item => item.id === bank.id))} />
      : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{group.materials.map(material => <article key={material.id} className="learning-card min-w-0 rounded-2xl border bg-white p-5 sm:p-6">
        <MaterialIcon icon={material.icon} className="size-12 text-teal-700 dark:text-teal-200" />
        <h3 dir="auto" className="mt-4 break-words text-lg font-semibold text-slate-950">{material.name}</h3>
        <p dir="auto" className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{material.description}</p>
        <p className="mt-4 flex items-start gap-2 text-sm text-slate-600"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{group.key === "SUBJECT" ? "Subject lessons require approved Subjects access." : "Questions and exams require approved track access."}</p>
        {group.key !== "SUBJECT" && <Link href="/student/question-banks" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white">Sign In / Request Access</Link>}
      </article>)}</div>}</div>
  </section>)}</div>;
}
