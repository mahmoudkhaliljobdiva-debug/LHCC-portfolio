import Link from "next/link";
import type { Route } from "next";

import { getPreviewDirectory, parsePreviewRole } from "@/lib/portal-preview/server";

export default async function PreviewSelector({ params, searchParams }: {
  readonly params: Promise<{ role: string }>;
  readonly searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const role = parsePreviewRole((await params).role);
  const { q = "", status = "", page = "1" } = await searchParams;
  const directory = await getPreviewDirectory(role, q, status, Number(page));
  const label = role === "student" ? "Student" : "Teacher";
  const pageHref = (number: number) => `/admin/view-as/${role}?${new URLSearchParams({ q, status, page: String(number) })}` as Route;
  return <>
    <h1 className="text-2xl font-semibold text-slate-950">View {label} Portal</h1>
    <p className="mt-2 text-sm text-slate-500">Choose an account to inspect. You remain signed in as Administrator.</p>
    <form className="my-6 flex flex-col gap-3 sm:flex-row" action={`/admin/view-as/${role}`}>
      <div className="flex-1"><label htmlFor="preview-search" className="mb-2 block text-sm font-medium text-slate-700">Search name or email</label><input id="preview-search" name="q" defaultValue={q} maxLength={100} className="w-full rounded-xl border bg-white px-4 py-3 text-sm" /></div>
      <div><label htmlFor="preview-status" className="mb-2 block text-sm font-medium text-slate-700">Profile status</label><select id="preview-status" name="status" defaultValue={status} className="w-full rounded-xl border bg-white px-4 py-3 text-sm"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="EXPIRED">Expired</option></select></div>
      <button className="self-end rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">Search</button>
    </form>
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">{label} accounts available for read-only preview</caption><thead className="border-b bg-slate-50 text-slate-600"><tr>{["Name", "Email", "Effective status", "Preview"].map(value => <th scope="col" key={value} className="px-5 py-4 font-medium">{value}</th>)}</tr></thead><tbody>{directory.users.map(user => <tr key={user.id} className="border-b last:border-0"><td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">{user.name}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{user.email}</td><td className="px-5 py-4 text-slate-600">{user.status}</td><td className="px-5 py-4"><Link prefetch={false} href={`/admin/view-as/${role}/${user.id}` as Route} aria-label={`View ${user.name}`} className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white">View</Link></td></tr>)}</tbody></table>{!directory.users.length && <p className="p-8 text-center text-sm text-slate-500">No {role}s available to view.</p>}</div>
    <nav aria-label="Selector pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>Page {directory.page} · {directory.total} matching accounts</span><div className="flex gap-4">{directory.page > 1 && <Link href={pageHref(directory.page - 1)}>Previous</Link>}{directory.page * 20 < directory.total && <Link href={pageHref(directory.page + 1)}>Next</Link>}</div></nav>
  </>;
}
