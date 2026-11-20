import { AdminLessons } from "@/features/lessons/admin-lessons";
import { getAdminSubjectLessons } from "@/lib/learning/lessons";

export default async function SubjectLessonsPage({ params, searchParams }: {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<{ lesson?: string | string[] }>;
}) {
  const [{ bankId }, query] = await Promise.all([params, searchParams]);
  const lessonId = typeof query.lesson === "string" ? query.lesson : null;
  const result = await getAdminSubjectLessons(bankId, lessonId);
  if (!result.ok) return <section className="rounded-2xl border bg-white p-6 dark:bg-slate-900"><h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">Chapters & lessons</h1><p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{result.error.message}</p></section>;
  return <AdminLessons key={`${bankId}:${lessonId ?? "index"}`} initial={result.data} />;
}
