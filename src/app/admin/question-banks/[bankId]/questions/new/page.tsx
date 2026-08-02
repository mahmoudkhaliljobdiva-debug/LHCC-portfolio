import { AdminQuestionForm } from "@/features/question-banks/admin-question-form";

export default async function NewQuestionPage({ params }: { readonly params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  return <AdminQuestionForm bankId={bankId} />;
}
