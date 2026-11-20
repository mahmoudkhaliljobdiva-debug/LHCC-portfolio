import Link from "next/link";
import { getAdminSharedExams } from "@/lib/learning/server";
import { AdminSharedExams } from "@/features/learning/admin-shared-exams";
export default async function Page({params,searchParams}:{params:Promise<{bankId:string}>;searchParams:Promise<{page?:string}>}) {
  const {bankId}=await params;const query=await searchParams;const parsed=Number(query.page??0);const page=Number.isInteger(parsed)&&parsed>=0&&parsed<=100000?parsed:0;
  const exams=await getAdminSharedExams(bankId,page);
  return <><Link href={`/admin/question-banks/${bankId}`} className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">Back to material</Link><AdminSharedExams bankId={bankId} exams={exams}/><nav aria-label="Shared exam pages" className="mt-6 flex flex-wrap items-center gap-4">{page>0&&<Link href={`/admin/question-banks/${bankId}/shared-exams?page=${page-1}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-slate-700">Previous exams</Link>}<span className="text-sm text-slate-600">Page {page+1}</span>{exams.length===5&&<Link href={`/admin/question-banks/${bankId}/shared-exams?page=${page+1}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-slate-700">Next exams</Link>}</nav></>;
}
