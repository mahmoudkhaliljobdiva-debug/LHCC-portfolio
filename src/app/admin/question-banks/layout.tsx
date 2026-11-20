import { AdminQuestionBankProvider } from "@/features/question-banks/admin-question-bank-provider";
import { getAdminBankData } from "@/lib/bank-access/server";

export default async function BankManagementLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = await getAdminBankData();
  return <AdminQuestionBankProvider data={data}>{children}</AdminQuestionBankProvider>;
}
