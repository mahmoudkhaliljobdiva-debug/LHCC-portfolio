import { PublicFooter } from "@/layouts/public-layout/public-footer";
import { PublicHeader } from "@/layouts/public-layout/public-header";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </>
  );
}

