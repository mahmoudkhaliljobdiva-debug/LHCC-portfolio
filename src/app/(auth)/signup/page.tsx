import type { Metadata } from "next";

import { SignupForm } from "@/features/users/signup-form";

export const metadata: Metadata = {
  title: "Create account | L.H.C.C",
  description: "Apply for access to the L.H.C.C healthcare learning platform.",
};

export default function SignupPage() {
  return <SignupForm />;
}
