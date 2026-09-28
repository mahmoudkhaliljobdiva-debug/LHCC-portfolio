import Link from "next/link";
import { portalForRole, requireAuthenticatedUser, getAuthenticatedProfile } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { OwnProfileEditor } from "@/features/users/own-profile-editor";

export default async function AccountSettingsPage() {
  await requireAuthenticatedUser();
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/unauthorized?reason=profile");
  return <section className="mx-auto max-w-3xl px-5 py-12"><h1 className="mb-6 text-3xl font-semibold text-slate-950">Account settings</h1><OwnProfileEditor profile={profile} /><Link href={portalForRole(profile.role)} className="mt-6 inline-flex rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">Return to portal</Link></section>;
}
