import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { AdminQuestionBankProvider } from "@/features/question-banks/admin-question-bank-provider";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminQuestionBankProvider><DashboardShell role="admin">{children}</DashboardShell></AdminQuestionBankProvider>;
}
