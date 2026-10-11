import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BookOpen } from "lucide-react";
import { SpecialtyIcon } from "@/components/ui/specialty-icon";
import type { LearningCatalog } from "@/types/learning-catalog";
import type { StudentBank } from "@/types/bank-access";
export function SpecialtyCatalog({ catalog, banks, publicView = false }: { catalog: LearningCatalog; banks?: StudentBank[]; publicView?: boolean }) {
  const access = new Map(banks?.map(b => [b.id,b.accessState]));
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{catalog.map(s => {
    const approved = s.materials.filter(m => access.get(m.id)==="APPROVED").length;
    return <Link key={s.id} href={`${publicView ? "/programs" : "/student/specialties"}/${s.slug}` as Route} className="learning-card group min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <span className="learning-icon grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-700"><SpecialtyIcon icon={s.icon}/></span>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{s.name}</h3>
      {s.description && <p className="mt-2 break-words text-sm leading-6 text-slate-600">{s.description}</p>}
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><BookOpen className="size-4 shrink-0" aria-hidden="true"/>{s.materials.length} published {s.materials.length===1 ? "material" : "materials"}</p>
      {!s.materials.length && <p className="mt-2 text-sm text-slate-500">No materials published yet.</p>}
      {banks && s.materials.length>0 && <p className="mt-2 text-xs text-slate-500">{approved} approved · Other materials require access approval</p>}
      <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700">Explore {s.name}<ArrowRight className="size-4" aria-hidden="true"/></span>
    </Link>;
  })}{!catalog.length && <p className="rounded-xl border p-5 text-slate-600">No learning programs have been published yet.</p>}</div>;
}
