"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownProfileSchema } from "@/lib/validation/profile";
import { isCountryCode, normalizePhoneNumber } from "@/lib/phone";
import type { OwnProfileInput } from "@/types/own-profile";
import type { ServerResult } from "@/types/server-result";

export async function saveOwnProfile(input: OwnProfileInput): Promise<ServerResult<OwnProfileInput>> {
  const parsed = ownProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Check your profile details.", fieldErrors: parsed.error.flatten().fieldErrors } };
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again." } };
    // Actor ID comes only from verified Auth, never from a form/preview target.
    // Direct profile UPDATE remains blocked by RLS; this narrow server action
    // explicitly allowlists personal fields and cannot change access or roles.
    const value = parsed.data;
    const phone = value.phone && value.countryCode && isCountryCode(value.countryCode)
      ? normalizePhoneNumber(value.phone, value.countryCode) : null;
    const { data, error } = await createAdminClient().from("profiles").update({
      full_name: value.fullName, country_code: value.countryCode, phone,
      age: value.age, gender: value.gender === "male" ? "MALE" : value.gender === "female" ? "FEMALE" : null, home_address: value.homeAddress || null,
    }).eq("id", auth.user.id).select("full_name,country_code,phone,age,gender,home_address").maybeSingle();
    if (error || !data) return { ok: false, error: { code: "INTERNAL_ERROR", message: "Your profile could not be saved. Please try again." } };
    revalidatePath("/", "layout");
    return { ok: true, data: { fullName: data.full_name, countryCode: data.country_code, phone: data.phone, age: data.age, gender: data.gender === "MALE" ? "male" : data.gender === "FEMALE" ? "female" : null, homeAddress: data.home_address } };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Your profile could not be saved. Please try again." } };
  }
}
