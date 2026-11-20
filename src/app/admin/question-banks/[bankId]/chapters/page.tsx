import { notFound } from "next/navigation";
import { getAdminChapters } from "@/lib/learning/chapters";
import { AdminChapters } from "@/features/learning/admin-chapters";
export default async function Page({ params, searchParams }: {
  params: Promise<{ bankId: string }>; searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { bankId } = await params; const query = await searchParams; const page = Number(query.page ?? 0);
  const data = await getAdminChapters(bankId, page, query.q ?? ""); if (!data) notFound();
  return <AdminChapters data={data} page={page} search={query.q ?? ""} />;
}
