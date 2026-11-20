import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { requireRole } from "@/lib/auth/server";

export default async function TeacherLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("TEACHER");
  return <DashboardShell role="teacher" displayName={profile.full_name}>{children}</DashboardShell>;
}
