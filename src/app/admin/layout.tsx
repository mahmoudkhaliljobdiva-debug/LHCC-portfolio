import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { AdminQuestionBankProvider } from "@/features/question-banks/admin-question-bank-provider";
import { requireRole } from "@/lib/auth/server";
import { getAdminBankData } from "@/lib/bank-access/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("ADMIN");
  const data = await getAdminBankData();
  return <AdminQuestionBankProvider data={data}><DashboardShell role="admin" displayName={profile.full_name}>{children}</DashboardShell></AdminQuestionBankProvider>;
}
