import { AdminQuestionForm } from "@/features/question-banks/admin-question-form";

export default async function NewQuestionPage({ params, searchParams }: { readonly params: Promise<{ bankId: string }>; readonly searchParams: Promise<{ sectionId?: string }> }) {
  const { bankId } = await params;
  const { sectionId } = await searchParams;
  return <AdminQuestionForm bankId={bankId} initialSectionId={sectionId} />;
}
