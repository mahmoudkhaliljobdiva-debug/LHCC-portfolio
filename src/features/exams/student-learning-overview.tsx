import Link from "next/link";
import type { Route } from "next";
import { Archive, BookOpen, ChartNoAxesCombined, ArrowRight } from "lucide-react";
import { getStudentBanks } from "@/lib/bank-access/server";
import { getExamBank } from "@/lib/exams/server";
export async function StudentLearningOverview() {
  const approved = (await getStudentBanks()).filter(b=>b.accessState==="APPROVED");
  const banks = (await Promise.all(approved.map(b=>getExamBank(b.id)))).filter(b=>b!==null);
  const unfinished = banks.flatMap(b=>b.attempts.filter(a=>a.mode==="EXAM" && a.status==="IN_PROGRESS").map(a=>({ ...a,bankName:b.name })));
  return <section className="mb-7 space-y-5"><div className="grid gap-4 md:grid-cols-3">{[
    { title:"Past Year Exams",description:"Original examinations, organized by year and session.",icon:Archive,href:"/student/question-banks" },
    { title:"Complete Question Bank",description:"Practice all questions, random exams or clinical cases.",icon:BookOpen,href:"/student/question-banks" },
    { title:"My Progress",description:"Continue sessions and review your recorded results.",icon:ChartNoAxesCombined,href:"/student/exams" },
  ].map(item=><Link key={item.title} href={item.href as Route} className="min-w-0 rounded-2xl border bg-white p-5"><item.icon className="size-6 text-teal-700 dark:text-teal-200" /><h2 className="mt-4 font-semibold text-slate-950">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></Link>)}</div>
  {unfinished.length>0 && <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold text-slate-950">Continue learning</h2>{unfinished.map(a=><Link key={a.id} href={`/student/exams/${a.id}` as Route} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm font-medium text-slate-700"><span>{a.bankName} · {a.totalQuestions} questions</span><span className="inline-flex items-center gap-2">Continue<ArrowRight className="size-4" /></span></Link>)}</div>}
  <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold text-slate-950">Your available banks</h2>{banks.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{banks.map(b=><article key={b.id} className="min-w-0 rounded-xl border p-4"><h3 className="break-words font-medium text-slate-950">{b.name}</h3><p className="mt-2 text-xs text-slate-500">{b.available} complete-bank questions · {b.pastExams.length} published past exams</p><div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-teal-700 dark:text-teal-200"><Link className="py-2" href={`/student/banks/${b.id}/past-exams` as Route}>Past Year Exams</Link><Link className="py-2" href={`/student/banks/${b.id}` as Route}>Complete Bank</Link></div></article>)}</div> : <p className="mt-4 text-sm text-slate-500">Request question-bank access to begin. Your administrator reviews access requests.</p>}</div></section>;
}
