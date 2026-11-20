import type { Metadata } from "next";

import { LoginForm } from "@/features/users/login-form";

export const metadata: Metadata = {
  title: "Log in",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <LoginForm reason={reason} />;
}
