import { PublicFooter } from "@/layouts/public-layout/public-footer";
import { PublicHeader } from "@/layouts/public-layout/public-header";
import { getAuthenticatedProfile, portalForRole } from "@/lib/auth/server";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getAuthenticatedProfile();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Lebanese Health & Competence Center",
            alternateName: "L.H.C.C",
            url: "https://lhcc-lb.com",
            logo: "https://lhcc-lb.com/images/lhcc-logo-round.png",
          }),
        }}
      />
      <PublicHeader displayName={profile?.full_name} dashboardHref={profile ? portalForRole(profile.role) : undefined} />
      <main>{children}</main>
      <PublicFooter />
    </>
  );
}
