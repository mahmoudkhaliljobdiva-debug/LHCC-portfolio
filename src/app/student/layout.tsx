import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";

export default function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell role="student">{children}</DashboardShell>;
}

