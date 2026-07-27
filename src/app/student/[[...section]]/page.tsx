import { RoleScreen } from "@/features/dashboard/role-screen";

export default async function StudentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <RoleScreen role="student" section={section?.[0]} />;
}

