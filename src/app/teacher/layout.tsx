import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";

export default function TeacherLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell role="teacher">{children}</DashboardShell>;
}

