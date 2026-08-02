import { LoginForm } from "@/features/users/login-form";

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <LoginForm reason={reason} />;
}
