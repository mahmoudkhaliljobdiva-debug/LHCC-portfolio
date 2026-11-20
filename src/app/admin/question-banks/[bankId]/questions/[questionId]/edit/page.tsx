import { AdminQuestionForm } from "@/features/question-banks/admin-question-form";

export default async function EditQuestionPage({ params }: { readonly params: Promise<{ bankId: string; questionId: string }> }) {
  const { bankId, questionId } = await params;
  return <AdminQuestionForm bankId={bankId} questionId={questionId} />;
}
