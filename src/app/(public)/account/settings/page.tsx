import Link from "next/link";
import { portalForRole, requireActiveProfile } from "@/lib/auth/server";

export default async function AccountSettingsPage() {
  const profile = await requireActiveProfile();
  const fields = [["Full name", profile.full_name], ["Role", profile.role], ["Country", profile.country_code], ["Phone", profile.phone], ["Age", profile.age], ["Gender", profile.gender], ["Home address", profile.home_address]];
  return <section className="mx-auto max-w-3xl px-5 py-12"><h1 className="text-3xl font-semibold text-slate-950">Account settings</h1><dl className="mt-6 grid gap-5 rounded-2xl border bg-white p-6 sm:grid-cols-2">{fields.map(([label, value]) => <div key={String(label)}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value ?? "Not provided"}</dd></div>)}</dl><p className="mt-5 text-sm text-slate-500">Profile changes are managed by an administrator.</p><Link href={portalForRole(profile.role)} className="mt-6 inline-flex rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">Return to portal</Link></section>;
}
