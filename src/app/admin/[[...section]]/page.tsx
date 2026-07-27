import { RoleScreen } from "@/features/dashboard/role-screen";

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <RoleScreen role="admin" section={section?.[0]} />;
}

