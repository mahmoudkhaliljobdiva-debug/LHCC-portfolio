"use client";

import { Activity, Edit3, Plus, Power, PowerOff, Search, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  createUser,
  deactivateUser,
  reactivateStudent,
  reactivateTeacher,
  updateUser,
} from "@/actions/admin-users";
import {
  DeactivateDialog,
  ReactivateDialog,
  UserFormDialog,
  type UserDialogState,
} from "@/features/users/admin-user-dialogs";
import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { cn } from "@/lib/cn";
import type { ServerResult } from "@/types/server-result";
import type { EffectiveUserStatus, ManagedUserRole, PlatformUser, PlatformUserInput } from "@/types/user-management";
import { getEffectiveUserStatus, getRemainingDays } from "@/utils/user-activation";

type SortKey = "name" | "role" | "status" | "expiration";

interface AdminUsersPageProps {
  readonly initialUsers: readonly PlatformUser[];
  readonly initialError?: string | undefined;
}

export function AdminUsersPage({ initialUsers, initialError }: AdminUsersPageProps) {
  const bankStore = useAdminQuestionBanks();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | ManagedUserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EffectiveUserStatus>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [dialog, setDialog] = useState<UserDialogState | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PlatformUser | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<PlatformUser | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState(initialError ?? null);

  const rows = useMemo(() => users.map((user) => ({
    user,
    effectiveStatus: getEffectiveUserStatus(user),
  })).filter((row) => {
    const query = search.trim().toLocaleLowerCase();
    return (!query
      || row.user.fullName.toLocaleLowerCase().includes(query)
      || row.user.email.toLocaleLowerCase().includes(query))
      && (roleFilter === "all" || row.user.role === roleFilter)
      && (statusFilter === "all" || row.effectiveStatus === statusFilter);
  }).sort((a, b) => {
    if (sort === "name") return a.user.fullName.localeCompare(b.user.fullName);
    if (sort === "role") return a.user.role.localeCompare(b.user.role);
    if (sort === "status") return a.effectiveStatus.localeCompare(b.effectiveStatus);
    return (a.user.expirationDate ?? "9999-12-31").localeCompare(b.user.expirationDate ?? "9999-12-31");
  }), [roleFilter, search, sort, statusFilter, users]);

  const stats = useMemo(() => ({
    total: users.length,
    students: users.filter((user) => user.role === "student" && isEffectivelyActive(user)).length,
    teachers: users.filter((user) => user.role === "teacher" && isEffectivelyActive(user)).length,
    inactive: users.filter((user) => ["inactive", "expired"].includes(getEffectiveUserStatus(user))).length,
    expiring: users.filter((user) => getEffectiveUserStatus(user) === "expiring-soon").length,
  }), [users]);

  const summaryCards: readonly { readonly label: string; readonly value: number; readonly icon: LucideIcon }[] = [
    { label: "Total users", value: stats.total, icon: Users },
    { label: "Active students", value: stats.students, icon: UserCheck },
    { label: "Active teachers", value: stats.teachers, icon: UserCheck },
    { label: "Inactive users", value: stats.inactive, icon: PowerOff },
    { label: "Expiring soon", value: stats.expiring, icon: Activity },
  ];

  function clearFeedback(): void {
    setSuccess(null);
    setPageError(null);
  }

  function replaceUser(user: PlatformUser): void {
    setUsers((current) => current.some((item) => item.id === user.id)
      ? current.map((item) => item.id === user.id ? user : item)
      : [user, ...current]);
  }

  async function saveUser(input: PlatformUserInput): Promise<ServerResult<PlatformUser>> {
    clearFeedback();
    const result = dialog?.mode === "edit"
      ? await updateUser({ ...input, userId: dialog.user.id })
      : await createUser(input);

    if (result.ok) {
      replaceUser(result.data);
      setSuccess(`${result.data.fullName} ${dialog?.mode === "edit" ? "updated" : "invited"} successfully.`);
      setDialog(null);
    }
    return result;
  }

  async function confirmDeactivation(): Promise<ServerResult<PlatformUser>> {
    if (!deactivateTarget) return unavailableResult();
    clearFeedback();
    const result = await deactivateUser({ userId: deactivateTarget.id });
    if (result.ok) {
      replaceUser(result.data);
      setSuccess(`${result.data.fullName} was deactivated.`);
      setDeactivateTarget(null);
    }
    return result;
  }

  async function confirmReactivation(months: number): Promise<ServerResult<PlatformUser>> {
    if (!reactivateTarget) return unavailableResult();
    clearFeedback();
    const result = reactivateTarget.role === "student"
      ? await reactivateStudent({ userId: reactivateTarget.id })
      : await reactivateTeacher({ userId: reactivateTarget.id, activationMonths: months });
    if (result.ok) {
      replaceUser(result.data);
      setSuccess(`${result.data.fullName} was reactivated with a new activation period.`);
      setReactivateTarget(null);
    }
    return result;
  }

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">Account administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Users</h1>
          <p className="mt-2 text-sm text-slate-500">Manage real student and teacher accounts, invitations, and activation periods.</p>
        </div>
        <button type="button" onClick={() => { clearFeedback(); setDialog({ mode: "add" }); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">
          <Plus className="size-4" />Add User
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>
              <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon className="size-5" /></span>
            </div>
          </article>
        ))}
      </div>

      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div>}
      {pageError && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{pageError}</div>}

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-[1fr_180px_190px_190px]">
          <label className="relative"><span className="sr-only">Search by name or email</span><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="h-10 w-full rounded-xl border bg-slate-50 pr-3 pl-9 text-sm" /></label>
          <Filter value={roleFilter} onChange={(value) => setRoleFilter(value as "all" | ManagedUserRole)} options={[["all", "All roles"], ["student", "Students"], ["teacher", "Teachers"]]} label="Role filter" />
          <Filter value={statusFilter} onChange={(value) => setStatusFilter(value as "all" | EffectiveUserStatus)} options={[["all", "All statuses"], ["active", "Active"], ["inactive", "Inactive"], ["expired", "Expired"], ["expiring-soon", "Expiring soon"]]} label="Status filter" />
          <Filter value={sort} onChange={(value) => setSort(value as SortKey)} options={[["name", "Sort: Name"], ["role", "Sort: Role"], ["status", "Sort: Status"], ["expiration", "Sort: Expiration"]]} label="Sort users" />
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center"><Users className="mx-auto size-9 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">{pageError ? "Users could not be loaded." : roleFilter === "student" ? "No students match the selected filters." : "No users found."}</h2></div>
        ) : (
          <>
            <div className="grid gap-4 p-4 lg:hidden">{rows.map((row) => <UserCard key={row.user.id} row={row} onEdit={() => setDialog({ mode: "edit", user: row.user })} onActivate={() => setReactivateTarget(row.user)} onDeactivate={() => setDeactivateTarget(row.user)} />)}</div>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["User", "Email", "Role", "Status", "Activation", "Expiration", "Remaining", "Usage", "Actions"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <UserTableRow key={row.user.id} row={row} onEdit={() => setDialog({ mode: "edit", user: row.user })} onActivate={() => setReactivateTarget(row.user)} onDeactivate={() => setDeactivateTarget(row.user)} />)}</tbody></table></div>
          </>
        )}
      </section>

      {dialog && <UserFormDialog state={dialog} users={users} bankNames={bankStore.banks.map((bank) => bank.name)} onCancel={() => setDialog(null)} onSave={saveUser} />}
      {deactivateTarget && <DeactivateDialog user={deactivateTarget} onCancel={() => setDeactivateTarget(null)} onConfirm={confirmDeactivation} />}
      {reactivateTarget && <ReactivateDialog user={reactivateTarget} onCancel={() => setReactivateTarget(null)} onConfirm={confirmReactivation} />}
    </div>
  );
}

interface UserRowData { readonly user: PlatformUser; readonly effectiveStatus: EffectiveUserStatus }
interface RowActions { readonly row: UserRowData; readonly onEdit: () => void; readonly onActivate: () => void; readonly onDeactivate: () => void }

function UserTableRow(props: RowActions) {
  const { row } = props;
  return <tr className="border-t"><td className="px-5 py-4 font-semibold text-slate-900">{row.user.fullName}</td><td className="px-5 py-4 text-slate-600">{row.user.email}</td><td className="px-5 py-4"><RoleBadge role={row.user.role} /></td><td className="px-5 py-4"><StatusBadge status={row.effectiveStatus} /></td><td className="px-5 py-4 text-slate-600">{formatDate(row.user.activationStartDate)}</td><td className="px-5 py-4 text-slate-600">{formatDate(row.user.expirationDate)}</td><td className="px-5 py-4 text-slate-600">{remainingLabel(row.user, row.effectiveStatus)}</td><td className="px-5 py-4"><UsagePlaceholder /></td><td className="px-5 py-4"><Actions {...props} /></td></tr>;
}

function UserCard(props: RowActions) {
  const { row } = props;
  return <article className="rounded-xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{row.user.fullName}</h2><p className="mt-1 break-all text-sm text-slate-500">{row.user.email}</p></div><StatusBadge status={row.effectiveStatus} /></div><div className="mt-4 flex gap-2"><RoleBadge role={row.user.role} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Activation</dt><dd className="mt-1 text-slate-700">{formatDate(row.user.activationStartDate)}</dd></div><div><dt className="text-xs text-slate-500">Expiration</dt><dd className="mt-1 text-slate-700">{formatDate(row.user.expirationDate)}</dd></div></dl><div className="mt-4"><UsagePlaceholder /></div><div className="mt-4 border-t pt-3"><Actions {...props} /></div></article>;
}

function RoleBadge({ role }: { readonly role: ManagedUserRole }) { return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold capitalize text-sky-700">{role}</span>; }
function StatusBadge({ status }: { readonly status: EffectiveUserStatus }) { const labels = { active: "Active", inactive: "Inactive", expired: "Expired", "expiring-soon": "Expires Soon" }; return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", status === "active" ? "bg-emerald-50 text-emerald-700" : status === "expiring-soon" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700")}>{labels[status]}</span>; }
function UsagePlaceholder() { return <div className="text-xs leading-5 text-slate-500"><p className="font-medium text-slate-600">Usage deferred</p><p>Mock usage is not joined to real accounts.</p></div>; }

function Actions(props: RowActions) {
  const active = props.row.effectiveStatus === "active" || props.row.effectiveStatus === "expiring-soon";
  return <div className="flex flex-wrap items-center gap-1.5">{active ? <button type="button" onClick={props.onDeactivate} className="rounded-lg border p-2 text-rose-700" aria-label={`Deactivate ${props.row.user.fullName}`} title="Deactivate"><PowerOff className="size-4" /></button> : <button type="button" onClick={props.onActivate} className="rounded-lg border p-2 text-emerald-700" aria-label={`Reactivate ${props.row.user.fullName}`} title="Reactivate"><Power className="size-4" /></button>}<button type="button" onClick={props.onEdit} className="rounded-lg border p-2 text-slate-600" aria-label={`Edit ${props.row.user.fullName}`} title="Edit"><Edit3 className="size-4" /></button>{props.row.user.role === "student" && <button type="button" disabled className="rounded-lg border p-2 text-slate-400 opacity-60" aria-label={`Activity migration pending for ${props.row.user.fullName}`} title="Activity migration pending"><Activity className="size-4" /></button>}</div>;
}

function Filter({ value, options, label, onChange }: { readonly value: string; readonly options: readonly (readonly [string, string])[]; readonly label: string; readonly onChange: (value: string) => void }) { return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border bg-slate-50 px-3 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function isEffectivelyActive(user: PlatformUser): boolean { return ["active", "expiring-soon"].includes(getEffectiveUserStatus(user)); }
function remainingLabel(user: PlatformUser, status: EffectiveUserStatus): string { if (status === "expired") return "Expired"; if (status === "inactive") return "Inactive"; if (!user.expirationDate) return "Not configured"; const days = getRemainingDays(user.expirationDate); return `${days} ${days === 1 ? "day" : "days"}`; }
function formatDate(value: string | null): string { if (!value) return "Not configured"; return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`)); }
function unavailableResult(): ServerResult<never> { return { ok: false, error: { code: "NOT_FOUND", message: "The selected user is no longer available." } }; }
