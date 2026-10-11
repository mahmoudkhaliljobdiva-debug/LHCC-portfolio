import { RoleScreen } from "@/features/dashboard/role-screen";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { getStudentBanks } from "@/lib/bank-access/server";
import { notFound } from "next/navigation";
import { getLearningCatalog } from "@/lib/learning/server";
import { SpecialtyCatalog } from "@/features/learning/specialty-catalog";

export default async function StudentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section && (section.length !== 1 || !["exams", "analytics", "profile"].includes(section[0] ?? ""))) notFound();
  if(section)return <RoleScreen role="student" section={section[0]}/>;
  const [catalog,banks]=await Promise.all([getLearningCatalog(),getStudentBanks()]);
  return <><RoleScreen role="student" section={undefined}/><section className="mt-7"><h2 className="mb-4 text-xl font-semibold text-slate-950">Explore Your Learning</h2><SpecialtyCatalog catalog={catalog} banks={banks}/></section><section className="mt-7"><h2 className="mb-4 text-xl font-semibold text-slate-950">All materials</h2><QuestionBankGrid banks={banks}/></section></>;
}
