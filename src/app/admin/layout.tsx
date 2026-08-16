import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { AdminQuestionBankProvider } from "@/features/question-banks/admin-question-bank-provider";
import { requireRole } from "@/lib/auth/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("ADMIN");
  return <AdminQuestionBankProvider><DashboardShell role="admin" displayName={profile.full_name}>{children}</DashboardShell></AdminQuestionBankProvider>;
}
