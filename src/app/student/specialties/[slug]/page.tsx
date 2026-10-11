import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningCatalog } from "@/lib/learning/server";
import { getStudentBanks } from "@/lib/bank-access/server";
import { SpecialtyIcon } from "@/components/ui/specialty-icon";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const {slug}=await params; const [catalog,banks]=await Promise.all([getLearningCatalog(),getStudentBanks()]);
  const specialty=catalog.find(s=>s.slug===slug);if(!specialty)notFound();
  const ids=new Set(specialty.materials.map(m=>m.id));
  return <div className="space-y-6"><Link href="/student" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">Back to your learning</Link><header><span className="inline-flex rounded-xl bg-teal-50 p-3 text-teal-700"><SpecialtyIcon icon={specialty.icon}/></span><h1 className="mt-4 text-3xl font-semibold text-slate-950">{specialty.name}</h1>{specialty.description && <p className="mt-3 text-slate-600">{specialty.description}</p>}<h2 className="mt-6 text-xl font-semibold text-slate-950">Available Materials</h2></header><QuestionBankGrid banks={banks.filter(b=>ids.has(b.id))}/></div>;
}
