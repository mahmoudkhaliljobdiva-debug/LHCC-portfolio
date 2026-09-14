import { listUsers } from "@/actions/admin-users";
import { AdminUsersPage } from "@/features/users/admin-users-page";
import { getAdminUserUsageSummaries } from "@/lib/data/server";

export default async function UsersPage() {
  const [result, usage] = await Promise.all([listUsers(), getAdminUserUsageSummaries()]);
  return <AdminUsersPage initialUsers={result.ok ? result.data : []} usage={usage} initialError={result.ok ? undefined : result.error.message} />;
}
