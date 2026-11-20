import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { getStudentBanks } from "@/lib/bank-access/server";
export default async function StudentBanksPage() {
  return <><div className="mb-7"><h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Question banks</h1><p className="mt-2 text-sm text-slate-500">Explore available courses and request access to begin learning.</p></div><QuestionBankGrid banks={await getStudentBanks()} /></>;
}
