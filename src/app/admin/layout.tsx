import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell role="admin">{children}</DashboardShell>;
}

