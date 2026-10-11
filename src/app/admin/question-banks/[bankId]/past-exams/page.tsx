import { getAdminPastExams } from "@/lib/exams/admin-server";
import { AdminPastExams } from "@/features/exams/admin-past-exams";
export default async function Page({ params }: { params: Promise<{ bankId: string }> }) { const { bankId } = await params; return <AdminPastExams bankId={bankId} initial={await getAdminPastExams(bankId)} />; }
