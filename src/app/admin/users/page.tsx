import { listUsers } from "@/actions/admin-users";
import { AdminUsersPage } from "@/features/users/admin-users-page";
import { getAdminUserUsageSummaries } from "@/lib/data/server";

export default async function UsersPage({ searchParams }: { readonly searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const initialRole = role === "STUDENT" ? "student" : role === "TEACHER" ? "teacher" : "all";
  const [result, usage] = await Promise.all([listUsers(), getAdminUserUsageSummaries()]);
  return <AdminUsersPage initialRole={initialRole} initialUsers={result.ok ? result.data : []} usage={usage} initialError={result.ok ? undefined : result.error.message} />;
}
