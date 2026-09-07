import { AccessRequestManager } from "@/features/question-banks/access-request-manager";
import { getAdminRequests } from "@/lib/bank-access/server";
export default async function AccessRequestsPage() {
  return <AccessRequestManager requests={await getAdminRequests()} />;
}
