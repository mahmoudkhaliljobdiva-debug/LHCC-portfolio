import { RoleScreen } from "@/features/dashboard/role-screen";
import { notFound } from "next/navigation";

export default async function TeacherPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if ((section?.length ?? 0) > 1) notFound();
  return <RoleScreen role="teacher" section={section?.[0]} />;
}
