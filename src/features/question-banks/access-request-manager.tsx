"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBankAccessRequest, rejectBankAccessRequest } from "@/actions/bank-access";
import type { AdminAccessRequest } from "@/types/bank-access";
export function AccessRequestManager({ requests }: { readonly requests: AdminAccessRequest[] }) {
  const [filter, setFilter] = useState("PENDING");
  const visible = requests.filter((r) => filter === "ALL" || r.status === filter);
  return <><h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Course access requests</h1><p className="mt-2 text-sm text-slate-500">Approve course access independently of account status. Previous decisions remain in the history.</p><label className="mt-6 grid max-w-xs gap-2 text-sm font-medium text-slate-700">Request status<select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-11 rounded-xl border bg-white px-3">{["PENDING", "APPROVED", "REJECTED", "ALL"].map((status) => <option key={status}>{status}</option>)}</select></label><div className="mt-5 grid gap-4 lg:grid-cols-2">{visible.map((r) => <RequestCard key={r.id} request={r} />)}</div>{!visible.length && <p className="mt-5 rounded-2xl border bg-white p-6 text-slate-600">No requests in this category.</p>}</>;
}
function RequestCard({ request }: { readonly request: AdminAccessRequest }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  function review(approve: boolean) {
    startTransition(async () => {
      try {
        const result = approve ? await approveBankAccessRequest(request.id) : await rejectBankAccessRequest(request.id, reason);
        setFailed(!result.ok);
        setMessage(result.ok ? `Request ${approve ? "approved" : "rejected"}.` : result.error.message);
        router.refresh();
      } catch { setFailed(true); setMessage("Unable to review request. Please try again."); }
    });
  }
  return <article className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold text-slate-950">{request.student_name}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{request.status}</span></div><p className="mt-2 text-sm font-medium text-teal-700 dark:text-teal-200">{request.bank_name}</p><p className="mt-2 text-xs text-slate-500">Requested: {new Date(request.requested_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>{request.rejection_reason && <p className="mt-3 text-sm text-slate-600">Reason: {request.rejection_reason}</p>}{request.status === "PENDING" && <><label className="mt-4 grid gap-2 text-sm text-slate-700">Rejection reason (optional)<textarea maxLength={1000} rows={2} disabled={pending} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border bg-slate-50 p-3" /></label><div className="mt-4 flex flex-wrap gap-3"><button disabled={pending} onClick={() => review(true)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Approve"}</button><button disabled={pending} onClick={() => review(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-300 disabled:opacity-60">Reject</button></div></>}{message && <p role={failed ? "alert" : "status"} className="mt-3 text-sm text-slate-700">{message}</p>}</article>;
}
