import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { getStudentBanks } from "@/lib/bank-access/server";

export default async function StudentBanksPage() {
  const banks = await getStudentBanks();
  return <main className="space-y-6">
    <header>
      <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Courses</h1>
      <p className="mt-2 text-sm text-slate-600">
        All available courses published by LHCC. Request access once and track approval here.
      </p>
    </header>
    <QuestionBankGrid banks={banks} />
  </main>;
}
