import { AdminMaterials } from "@/features/learning/admin-materials";
import { getAdminMaterials } from "@/lib/learning/materials";
import { materialPageNumber } from "@/lib/validation/material";

export default async function ExamTracksPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = materialPageNumber((await searchParams).page);
  const result = await getAdminMaterials("EXAM_TRACK", page);
  if (!result.ok) return <section className="rounded-2xl border bg-white p-6 dark:bg-slate-900"><h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">Exam Tracks</h1><p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{result.error.message}</p></section>;
  return <AdminMaterials kind="EXAM_TRACK" page={page} {...result.data} />;
}
