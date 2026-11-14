import { AdminSubjectQuestions } from "@/features/learning/admin-subject-questions";
import { getSubjectQuestions } from "@/lib/learning/subject-questions";
import { materialPageNumber } from "@/lib/validation/material";

export default async function SubjectQuestionsPage({ params, searchParams }: {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<{ page?: string; search?: string; view?: string; chapter?: string }>;
}) {
  const [{ bankId }, query] = await Promise.all([params, searchParams]);
  const page = materialPageNumber(query.page), view = query.view === "review" ? "review" : "questions";
  const result = await getSubjectQuestions(bankId, page, query.search ?? "", view, query.chapter || null);
  if (!result.ok) return <section className="rounded-2xl border bg-white p-6 dark:bg-slate-900"><h1 className="text-2xl font-semibold">Subject questions</h1><p role="alert" className="mt-3 text-rose-700 dark:text-rose-300">{result.error.message}</p></section>;
  return <AdminSubjectQuestions key={JSON.stringify(query)} data={result.data} page={page} view={view} search={query.search ?? ""} chapter={query.chapter ?? ""} />;
}
