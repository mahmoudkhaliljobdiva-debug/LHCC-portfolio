import { DashboardShell } from "@/layouts/dashboard-layout/dashboard-shell";
import { requireRole } from "@/lib/auth/server";
import { StudentSpecialtyChooser } from "@/features/users/student-specialty-chooser";

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("STUDENT");
  return <DashboardShell role="student" displayName={profile.full_name}>
    {profile.specialty_id ? children : <StudentSpecialtyChooser />}
  </DashboardShell>;
}
