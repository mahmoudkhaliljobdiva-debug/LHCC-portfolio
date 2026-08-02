import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { ProtectedRoleGuard } from "@/features/users/protected-role-guard";

export default function TeacherLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedRoleGuard role="teacher"><DashboardShell role="teacher">{children}</DashboardShell></ProtectedRoleGuard>;
}
