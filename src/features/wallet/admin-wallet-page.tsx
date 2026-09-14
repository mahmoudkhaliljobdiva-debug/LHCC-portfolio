"use client";

import { ArrowDownCircle, ArrowUpCircle, CircleDollarSign, Edit3, Plus, Receipt, Trash2, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createWalletTicket, deleteWalletTicket, updateWalletTicket } from "@/actions/wallet";
import { WalletEarnedSpentChart } from "@/features/wallet/wallet-earned-spent-chart";
import { cn } from "@/lib/cn";
import type { WalletTicketInput, WalletTransaction, WalletTransactionType } from "@/types/user-management";
import { getRecentTransactions, getWalletChartData, getWalletSummary } from "@/utils/wallet-analytics";
import { getTodayDate } from "@/utils/user-activation";

type TransactionFilter = "all" | WalletTransactionType;
type DateFilter = "month" | "three-months" | "year" | "custom";

export function AdminWalletPage({ transactions }: { readonly transactions: readonly WalletTransaction[] }) {
  const router = useRouter();
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("year");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [ticket, setTicket] = useState<WalletTransaction | "new" | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<WalletTransaction | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const filtered = useMemo(() => transactions.filter((item) => (transactionFilter === "all" || item.type === transactionFilter) && inDateRange(item.transactionDate, dateFilter, customStart, customEnd)), [customEnd, customStart, dateFilter, transactions, transactionFilter]);
  const summary = useMemo(() => getWalletSummary(transactions), [transactions]);
  const chartData = useMemo(() => getWalletChartData(filtered), [filtered]);
  const recent = useMemo(() => getRecentTransactions(filtered), [filtered]);
  const manualTickets = filtered.filter((item) => item.type === "manual_income" || item.type === "manual_expense");
  const cards = [{ label: "Current Balance", value: summary.currentBalance, icon: WalletCards }, { label: "Total Income", value: summary.totalEarned, icon: ArrowUpCircle }, { label: "Total Outflow", value: summary.totalSpent, icon: ArrowDownCircle }, { label: "Bank Sales", value: summary.bankSales, icon: CircleDollarSign }, { label: "Other Income", value: summary.otherIncome, icon: Receipt }, { label: "Total Expenses", value: summary.totalExpenses, icon: ArrowDownCircle }];

  async function saveTicket(input: WalletTicketInput): Promise<string | null> {
    try {
      const result = ticket === "new" ? await createWalletTicket(crypto.randomUUID(), input) : ticket ? await updateWalletTicket(ticket.id, input) : null;
      if (!result) return "The selected ticket is unavailable.";
      if (!result.ok) return result.error.message;
      setFeedback({ type: "success", message: `Ticket ${ticket === "new" ? "added" : "updated"} successfully.` });
      setTicket(null);
      router.refresh();
      return null;
    } catch {
      return "Unable to save the wallet ticket. Please try again.";
    }
  }

  async function confirmDelete() {
    if (!deleteTicket) return;
    try {
      const result = await deleteWalletTicket(deleteTicket.id);
      if (!result.ok) { setFeedback({ type: "error", message: result.error.message }); return; }
      setFeedback({ type: "success", message: "Ticket deleted successfully." });
      setDeleteTicket(null);
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: "Unable to delete the wallet ticket." });
    }
  }

  return <div>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-teal-700">Business analytics</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Wallet Analytics</h1><p className="mt-2 text-sm text-slate-500">Real income, expenses, access sales, and immutable financial history.</p></div><button type="button" onClick={() => { setTicket("new"); setFeedback(null); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white"><Plus className="size-4" />Add Ticket</button></div>
    {feedback && <div role={feedback.type === "error" ? "alert" : "status"} className={cn("mb-5 rounded-xl border px-4 py-3 text-sm font-medium", feedback.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{feedback.message}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{cards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon className="size-5" /></span><p className="mt-4 text-sm text-slate-500">{label}</p><p className={cn("mt-1 text-2xl font-semibold", label === "Total Outflow" || label === "Total Expenses" ? "text-rose-700" : "text-slate-950")}>{formatCurrency(value)}</p></article>)}</div>
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="font-semibold text-slate-950">Earned versus spent</h2><p className="mt-1 text-xs text-slate-500">Monthly values calculated from real wallet transactions.</p></div><WalletFilters transactionFilter={transactionFilter} dateFilter={dateFilter} customStart={customStart} customEnd={customEnd} onTransaction={setTransactionFilter} onDate={setDateFilter} onStart={setCustomStart} onEnd={setCustomEnd} /></div>{chartData.length ? <div className="mt-5"><WalletEarnedSpentChart data={chartData} /></div> : <div className="py-16 text-center text-sm text-slate-500">No wallet transactions match these filters.</div>}</section>
    <TransactionTable transactions={recent} />
    <ManualTicketTable transactions={manualTickets} onEdit={setTicket} onDelete={setDeleteTicket} />
    {ticket && <TicketDialog ticket={ticket} onCancel={() => setTicket(null)} onSave={saveTicket} />}
    {deleteTicket && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-ticket-title" className="w-full max-w-md rounded-2xl border bg-white p-6"><h2 id="delete-ticket-title" className="text-lg font-semibold text-slate-950">Delete {deleteTicket.name}?</h2><p className="mt-2 text-sm text-slate-500">This manual ticket will be removed from wallet calculations.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeleteTicket(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={confirmDelete} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white">Delete ticket</button></div></div></div>}
  </div>;
}

function TransactionTable({ transactions }: { readonly transactions: readonly WalletTransaction[] }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="font-semibold text-slate-950">Recent Transactions</h2><p className="mt-1 text-xs text-slate-500">Automatic transactions are immutable; corrections create adjustments.</p></div>{transactions.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">No transactions found.</div> : <div className="table-scroll-region" role="region" aria-label="Wallet transactions" tabIndex={0}><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Transaction", "Type", "User", "Question bank", "Amount", "Date", "Source", "Status"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{transactions.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{item.name}</p>{item.description && <p className="mt-1 max-w-sm text-xs text-slate-500">{item.description}</p>}</td><td className="px-5 py-4 text-slate-600">{sourceLabel(item.type)}</td><td className="px-5 py-4 text-slate-600">{item.userName ?? (item.userId ? "Deleted user" : "—")}</td><td className="px-5 py-4 text-slate-600">{item.bankName ?? item.bankId ?? "—"}</td><td className={cn("px-5 py-4 font-semibold", item.amount > 0 ? "text-emerald-700" : "text-rose-700")}>{item.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(item.amount))}</td><td className="px-5 py-4 text-slate-600">{formatDate(item.transactionDate)}</td><td className="px-5 py-4 text-slate-600">{sourceLabel(item.type)}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Recorded</span></td></tr>)}</tbody></table></div>}</section>;
}

function ManualTicketTable({ transactions, onEdit, onDelete }: { readonly transactions: readonly WalletTransaction[]; readonly onEdit: (item: WalletTransaction) => void; readonly onDelete: (item: WalletTransaction) => void }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="font-semibold text-slate-950">Ticket Management</h2><p className="mt-1 text-xs text-slate-500">Manual income and expense tickets may be corrected or removed.</p></div>{transactions.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">No manual tickets match these filters.</div> : <div className="table-scroll-region" role="region" aria-label="Manual wallet tickets" tabIndex={0}><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Ticket", "Type", "Category", "Amount", "Date", "Actions"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{transactions.map((item) => <tr key={item.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{item.name}</p>{item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}</td><td className="px-5 py-4 text-slate-600">{item.type === "manual_income" ? "Income" : "Expense"}</td><td className="px-5 py-4 text-slate-600">{item.category || "—"}</td><td className={cn("px-5 py-4 font-semibold", item.amount > 0 ? "text-emerald-700" : "text-rose-700")}>{item.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(item.amount))}</td><td className="px-5 py-4 text-slate-600">{formatDate(item.transactionDate)}</td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`} className="grid size-11 place-items-center rounded-xl border text-slate-600"><Edit3 className="size-4" /></button><button type="button" onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`} className="grid size-11 place-items-center rounded-xl border text-rose-700"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div>}</section>;
}

function TicketDialog({ ticket, onCancel, onSave }: { readonly ticket: WalletTransaction | "new"; readonly onCancel: () => void; readonly onSave: (input: WalletTicketInput) => Promise<string | null> }) {
  const current = ticket === "new" ? undefined : ticket;
  const [name, setName] = useState(current?.name ?? ""); const [description, setDescription] = useState(current?.description ?? "");
  const [type, setType] = useState<"manual_income" | "manual_expense">(current?.type === "manual_expense" ? "manual_expense" : "manual_income");
  const [amount, setAmount] = useState(current ? String(Math.abs(current.amount)) : ""); const [date, setDate] = useState(current?.transactionDate ?? getTodayDate()); const [category, setCategory] = useState(current?.category ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); const next: Record<string, string> = {}; if (!name.trim()) next.name = "Ticket name is required."; const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) next.amount = "Amount must be greater than zero."; if (!date) next.date = "Transaction date is required."; setErrors(next); if (Object.keys(next).length) return; setSaving(true); const base = { name: name.trim(), type, amount: numericAmount, transactionDate: date }; const error = await onSave({ ...base, ...(description.trim() ? { description: description.trim() } : {}), ...(category.trim() ? { category: category.trim() } : {}) }); if (error) setErrors({ form: error }); setSaving(false); }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="ticket-title" className="w-full max-w-xl rounded-2xl border bg-white p-6"><h2 id="ticket-title" className="text-xl font-semibold text-slate-950">{current ? "Edit wallet ticket" : "Add wallet ticket"}</h2>{errors.form && <p role="alert" className="mt-4 text-sm text-rose-700">{errors.form}</p>}<div className="mt-6 grid gap-5"><TicketField label="Ticket name" value={name} error={errors.name} onChange={setName} /><TicketField label="Description (optional)" value={description} multiline onChange={setDescription} /><div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium text-slate-700">Type<select value={type} onChange={(event) => setType(event.target.value as "manual_income" | "manual_expense")} className="h-11 rounded-xl border bg-slate-50 px-3"><option value="manual_income">Income</option><option value="manual_expense">Expense</option></select></label><TicketField label="Amount (USD)" type="number" value={amount} error={errors.amount} onChange={setAmount} /><TicketField label="Transaction date" type="date" value={date} error={errors.date} onChange={setDate} /><TicketField label="Category (optional)" value={category} onChange={setCategory} /></div></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Ticket"}</button></div></form></div>;
}

function TicketField({ label, value, error, type = "text", multiline = false, onChange }: { readonly label: string; readonly value: string; readonly error?: string | undefined; readonly type?: "text" | "number" | "date"; readonly multiline?: boolean; readonly onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium text-slate-700">{label}{multiline ? <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border bg-slate-50 px-3 py-2" /> : <input type={type} min={type === "number" ? "0.01" : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={cn("h-11 rounded-xl border bg-slate-50 px-3", error && "border-rose-400")} />}{error && <span className="text-xs text-rose-700">{error}</span>}</label>; }
function WalletFilters({ transactionFilter, dateFilter, customStart, customEnd, onTransaction, onDate, onStart, onEnd }: { readonly transactionFilter: TransactionFilter; readonly dateFilter: DateFilter; readonly customStart: string; readonly customEnd: string; readonly onTransaction: (value: TransactionFilter) => void; readonly onDate: (value: DateFilter) => void; readonly onStart: (value: string) => void; readonly onEnd: (value: string) => void }) { return <div className="flex flex-wrap gap-2"><select value={transactionFilter} onChange={(event) => onTransaction(event.target.value as TransactionFilter)} aria-label="Transaction type filter" className="h-10 rounded-xl border bg-slate-50 px-3 text-sm"><option value="all">All transactions</option><option value="bank_sale">Bank sales</option><option value="bank_price_adjustment">Adjustments</option><option value="refund">Refunds</option><option value="manual_income">Income tickets</option><option value="manual_expense">Expense tickets</option></select><select value={dateFilter} onChange={(event) => onDate(event.target.value as DateFilter)} aria-label="Transaction date filter" className="h-10 rounded-xl border bg-slate-50 px-3 text-sm"><option value="month">This month</option><option value="three-months">Last 3 months</option><option value="year">This year</option><option value="custom">Custom range</option></select>{dateFilter === "custom" && <><input type="date" aria-label="Custom range start" value={customStart} onChange={(event) => onStart(event.target.value)} className="h-10 rounded-xl border bg-slate-50 px-3 text-sm" /><input type="date" aria-label="Custom range end" value={customEnd} onChange={(event) => onEnd(event.target.value)} className="h-10 rounded-xl border bg-slate-50 px-3 text-sm" /></>}</div>; }
function inDateRange(date: string, filter: DateFilter, start: string, end: string): boolean { const today = getTodayDate(); if (filter === "custom") return (!start || date >= start) && (!end || date <= end); if (filter === "year") return date.slice(0, 4) === today.slice(0, 4); if (filter === "month") return date.slice(0, 7) === today.slice(0, 7); const threshold = new Date(); threshold.setMonth(threshold.getMonth() - 3); return date >= getTodayDate(threshold) && date <= today; }
function sourceLabel(type: WalletTransactionType): string { return { bank_sale: "Bank Access Sale", bank_price_adjustment: "Bank Price Adjustment", refund: "Refund", manual_income: "Manual Income Ticket", manual_expense: "Manual Expense Ticket" }[type]; }
function formatCurrency(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)); }
