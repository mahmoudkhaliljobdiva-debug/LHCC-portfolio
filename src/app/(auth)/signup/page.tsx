import type { Metadata } from "next";

import { SignupForm } from "@/features/users/signup-form";
import { countryOptions } from "@/data/countries";

export const metadata: Metadata = {
  title: "Create account | L.H.C.C",
  description: "Create your L.H.C.C student account and explore healthcare courses.",
};

export default function SignupPage() {
  // Serialize one locale-resolved list to prevent server/browser ICU differences.
  return <SignupForm countryOptions={countryOptions} />;
}
