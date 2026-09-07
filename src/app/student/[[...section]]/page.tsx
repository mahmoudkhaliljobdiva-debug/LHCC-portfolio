import { RoleScreen } from "@/features/dashboard/role-screen";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { getStudentBanks } from "@/lib/bank-access/server";
import { notFound } from "next/navigation";

export default async function StudentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section && (section.length !== 1 || !["exams", "analytics", "profile"].includes(section[0] ?? ""))) notFound();
  return <><RoleScreen role="student" section={section?.[0]} />{!section && <section className="mt-7"><h2 className="mb-4 text-xl font-semibold text-slate-950">Explore courses</h2><QuestionBankGrid banks={await getStudentBanks()} /></section>}</>;
}
