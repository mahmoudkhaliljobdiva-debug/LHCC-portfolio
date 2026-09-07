"use client";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestBankAccess } from "@/actions/bank-access";
import type { StudentBank } from "@/types/bank-access";

const labels = { LOCKED: "Locked", PENDING: "Pending Approval", APPROVED: "Access Granted", REJECTED: "Access Request Rejected" };
export function QuestionBankGrid({ banks }: { readonly banks: StudentBank[] }) {
  if (!banks.length) return <p className="rounded-2xl border bg-white p-6 text-slate-600">No courses are currently available.</p>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{banks.map((bank) => <BankCard key={bank.id} bank={bank} />)}</div>;
}
function BankCard({ bank }: { readonly bank: StudentBank }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  function request() {
    startTransition(async () => {
      try {
        const result = await requestBankAccess(bank.id);
        setFailed(!result.ok);
        setFeedback(result.ok ? "Your request has been sent for approval." : result.error.message);
        router.refresh();
      } catch { setFailed(true); setFeedback("Unable to send your request. Please try again."); }
    });
  }
  return <article className="rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:text-teal-200"><BookOpen className="size-5" aria-hidden="true" /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bank.accessState === "APPROVED" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{labels[bank.accessState]}</span></div>
    <h2 className="mt-5 font-semibold text-slate-950">{bank.name}</h2>
    <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{bank.description}</p>
    {bank.accessState === "REJECTED" && bank.rejectionReason && <p className="mt-3 text-sm text-slate-600">Reason: {bank.rejectionReason}</p>}
    <div className="mt-5 border-t pt-4">
      {bank.accessState === "APPROVED" ? <Link href={`/student/banks/${bank.id}`} className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">Open Course<span className="sr-only">: {bank.name}</span></Link> : <button type="button" disabled={pending || bank.accessState === "PENDING"} onClick={request} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Sending…" : bank.accessState === "PENDING" ? "Pending Approval" : bank.accessState === "REJECTED" ? "Request Again" : "Request Access"}<span className="sr-only">: {bank.name}</span></button>}
    </div>
    {feedback && <p role={failed ? "alert" : "status"} className={`mt-3 text-sm ${failed ? "text-rose-700 dark:text-rose-300" : "text-teal-700 dark:text-teal-200"}`}>{feedback}</p>}
  </article>;
}
