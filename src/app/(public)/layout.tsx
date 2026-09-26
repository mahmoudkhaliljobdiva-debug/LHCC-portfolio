import { PublicFooter } from "@/layouts/public-layout/public-footer";
import { PublicHeader } from "@/layouts/public-layout/public-header";
import { getAuthenticatedProfile } from "@/lib/auth/server";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getAuthenticatedProfile();
  return (
    <>
      <PublicHeader displayName={profile?.full_name} />
      <main>{children}</main>
      <PublicFooter />
    </>
  );
}
