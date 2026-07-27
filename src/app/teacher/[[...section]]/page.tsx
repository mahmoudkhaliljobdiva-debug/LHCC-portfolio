import { RoleScreen } from "@/features/dashboard/role-screen";

export default async function TeacherPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <RoleScreen role="teacher" section={section?.[0]} />;
}

