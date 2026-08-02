import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { ProtectedRoleGuard } from "@/features/users/protected-role-guard";

export default function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedRoleGuard role="student"><DashboardShell role="student">{children}</DashboardShell></ProtectedRoleGuard>;
}
