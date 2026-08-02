import { notFound } from "next/navigation";

import { RoleScreen } from "@/features/dashboard/role-screen";

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section?.[0] === "reports") notFound();
  return <RoleScreen role="admin" section={section?.[0]} />;
}
