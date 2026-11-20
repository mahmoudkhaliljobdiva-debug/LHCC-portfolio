import { listUsers } from "@/actions/admin-users";
import { AdminUsersPage } from "@/features/users/admin-users-page";
import { getAdminUserUsageSummaries } from "@/lib/data/server";
import { getAdminBankOptions } from "@/lib/bank-access/server";

export default async function UsersPage({ searchParams }: { readonly searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const initialRole = role === "STUDENT" ? "student" : role === "TEACHER" ? "teacher" : "all";
  const [result, usage, banks] = await Promise.all([listUsers(), getAdminUserUsageSummaries(), getAdminBankOptions()]);
  return <AdminUsersPage banks={banks} initialRole={initialRole} initialUsers={result.ok ? result.data : []} usage={usage} initialError={result.ok ? undefined : result.error.message} />;
}
