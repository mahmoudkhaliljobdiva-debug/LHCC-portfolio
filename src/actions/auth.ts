"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getEffectiveProfileStatus, portalForRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, passwordRecoverySchema, studentRegistrationSchema, updatePasswordSchema } from "@/lib/validation/auth";
import type { ServerErrorCode, ServerResult } from "@/types/server-result";

interface LoginInput {
  readonly email: string;
  readonly password: string;
}

interface StudentRegistrationInput {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

interface StudentRegistrationResult {
  readonly requiresEmailConfirmation: boolean;
}

interface RecoveryInput {
  readonly email: string;
}

interface UpdatePasswordInput {
  readonly password: string;
  readonly confirmPassword: string;
}

export async function login(input: LoginInput): Promise<ServerResult<null>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);
  let destination: ReturnType<typeof portalForRole>;
  let supabase: Awaited<ReturnType<typeof createClient>> | undefined;

  try {
    supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword(parsed.data);

    if (authError || !authData.user) {
      return failure("AUTHENTICATION_FAILED", "The email or password is incorrect.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return failure("PROFILE_MISSING", "Your account is not ready. Please contact the administrator.");
    }

    const status = await getEffectiveProfileStatus(profile, supabase);
    if (status === "INACTIVE") {
      await supabase.auth.signOut();
      return failure("ACCOUNT_INACTIVE", "Your account is inactive. Please contact the administrator.");
    }
    if (status === "EXPIRED") {
      await supabase.auth.signOut();
      return failure("ACCOUNT_EXPIRED", "Your subscription has expired. Please contact the administrator to reactivate your account.");
    }

    destination = portalForRole(profile.role);
  } catch {
    if (supabase) await supabase.auth.signOut().catch(() => undefined);
    return failure("INTERNAL_ERROR", "Sign in is temporarily unavailable. Please try again.");
  }

  redirect(destination);
}

export async function registerStudent(
  input: StudentRegistrationInput,
): Promise<ServerResult<StudentRegistrationResult>> {
  const parsed = studentRegistrationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  try {
    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin");
    if (!origin) return failure("INTERNAL_ERROR", "Registration is temporarily unavailable.");

    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("next", "/login?reason=registration-confirmed");

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        data: { full_name: parsed.data.fullName },
      },
    });

    if (error || !data.user) {
      return failure("INTERNAL_ERROR", "Unable to create your account. Please try again later.");
    }

    // The database trigger forces public registrations to inactive students.
    // Do not retain a session if email confirmation is disabled.
    if (data.session) await supabase.auth.signOut();

    return { ok: true, data: { requiresEmailConfirmation: !data.session } };
  } catch {
    return failure("INTERNAL_ERROR", "Registration is temporarily unavailable. Please try again.");
  }
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: RecoveryInput): Promise<ServerResult<null>> {
  const parsed = passwordRecoverySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  try {
    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin");
    if (!origin) return failure("INTERNAL_ERROR", "Password recovery is temporarily unavailable.");

    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("next", "/login/update-password");
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: callbackUrl.toString(),
    });

    if (error) return failure("INTERNAL_ERROR", "Unable to send the recovery email. Please try again later.");
    return { ok: true, data: null };
  } catch {
    return failure("INTERNAL_ERROR", "Unable to send the recovery email. Please try again later.");
  }
}

export async function updatePassword(input: UpdatePasswordInput): Promise<ServerResult<null>> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  try {
    const supabase = await createClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claims?.claims.sub) {
      return failure("UNAUTHENTICATED", "The password recovery link is invalid or has expired.");
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return failure("INTERNAL_ERROR", "Unable to update the password. Request a new recovery link and try again.");

    await supabase.auth.signOut();
  } catch {
    return failure("INTERNAL_ERROR", "Unable to update the password. Please try again.");
  }

  redirect("/login?reason=password-updated");
}

function failure(code: ServerErrorCode, message: string): ServerResult<never> {
  return { ok: false, error: { code, message } };
}

function validationFailure(fieldErrors: Record<string, string[] | undefined>): ServerResult<never> {
  const normalized = Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1])),
  );
  return { ok: false, error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields and try again.", fieldErrors: normalized } };
}
