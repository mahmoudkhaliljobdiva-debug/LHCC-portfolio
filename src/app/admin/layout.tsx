import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { requireRole } from "@/lib/auth/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("ADMIN");
  return <DashboardShell role="admin" displayName={profile.full_name}>{children}</DashboardShell>;
}
