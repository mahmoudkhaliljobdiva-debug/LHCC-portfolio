import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { requireRole } from "@/lib/auth/server";

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("STUDENT");
  return <DashboardShell role="student" displayName={profile.full_name}>{children}</DashboardShell>;
}
