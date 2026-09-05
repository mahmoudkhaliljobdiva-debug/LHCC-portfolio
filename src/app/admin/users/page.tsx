import { listUsers } from "@/actions/admin-users";
import { AdminUsersPage } from "@/features/users/admin-users-page";

export default async function UsersPage() {
  const result = await listUsers();
  return <AdminUsersPage initialUsers={result.ok ? result.data : []} initialError={result.ok ? undefined : result.error.message} />;
}
