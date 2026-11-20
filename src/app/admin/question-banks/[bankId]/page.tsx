import { AdminQuestionBankDetail } from "@/features/question-banks/admin-question-bank-detail";

export default async function QuestionBankDetailPage({ params, searchParams }: { readonly params: Promise<{ bankId: string }>; readonly searchParams: Promise<{ saved?: string }> }) {
  const [{ bankId }, query] = await Promise.all([params, searchParams]);
  return <AdminQuestionBankDetail bankId={bankId} saved={query.saved} />;
}
