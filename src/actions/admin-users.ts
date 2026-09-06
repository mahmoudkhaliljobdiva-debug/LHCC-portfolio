"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { calculateActivationPeriod, getServerDate } from "@/lib/users/activation";
import {
  managedUserSchema,
  reactivateTeacherSchema,
  updateManagedUserSchema,
  userIdSchema,
} from "@/lib/validation/admin-user";
import type { ReactivateTeacherInput, UpdateManagedUserInput, UserIdInput } from "@/types/admin-user";
import type { ServerErrorCode, ServerResult } from "@/types/server-result";
import type { PlatformUser, PlatformUserInput } from "@/types/user-management";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AdminClient = ReturnType<typeof createAdminClient>;

export async function listUsers(): Promise<ServerResult<readonly PlatformUser[]>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;

  try {
    const admin = createAdminClient();
    const [authUsers, profilesResult] = await Promise.all([
      listAllAuthUsers(admin),
      admin
        .from("profiles")
        .select("*")
        .in("role", ["STUDENT", "TEACHER"])
        .order("created_at", { ascending: false }),
    ]);

    if (profilesResult.error) return failure("INTERNAL_ERROR", "Unable to load user profiles.");
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const users = profilesResult.data.flatMap((profile) => {
      const authUser = authById.get(profile.id);
      return authUser?.email ? [mapPlatformUser(profile, authUser.email)] : [];
    });

    return { ok: true, data: users };
  } catch {
    return failure("INTERNAL_ERROR", "User management is not configured or is temporarily unavailable.");
  }
}

export async function createUser(input: PlatformUserInput): Promise<ServerResult<PlatformUser>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;

  const parsed = managedUserSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  let period: ReturnType<typeof calculateActivationPeriod>;
  try {
    period = calculateActivationPeriod(
      parsed.data.activationStartDate,
      parsed.data.role,
      parsed.data.activationMonths,
    );
  } catch {
    return validationFailure({ activationStartDate: ["Choose a valid activation period."] });
  }

  try {
    const admin = createAdminClient();
    const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        data: {
          full_name: parsed.data.fullName,
          age: parsed.data.age,
          gender: parsed.data.gender?.toUpperCase() ?? null,
          home_address: parsed.data.homeAddress || null,
        },
        redirectTo: invitationRedirectUrl(),
      },
    );

    if (invitationError || !invitation.user) {
      return authMutationFailure(invitationError?.message, "Unable to invite this user.");
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: invitation.user.id,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
        age: parsed.data.age,
        gender: toDatabaseGender(parsed.data.gender),
        home_address: parsed.data.homeAddress || null,
        role: toDatabaseRole(parsed.data.role),
        status: toDatabaseStatus(parsed.data.status),
        activation_start: period.activationStart,
        activation_months: period.activationMonths,
        expiration_date: period.expirationDate,
        created_by: authorization.data.id,
        deactivated_at: parsed.data.status === "inactive" ? new Date().toISOString() : null,
        reactivated_at: null,
      }, { onConflict: "id" })
      .select("*")
      .single();

    if (profileError || !profile) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(invitation.user.id);
      if (cleanupError) console.error("[admin-users] Failed to roll back an incomplete invitation.");
      return failure("INTERNAL_ERROR", "The invitation could not be configured. No usable account was created.");
    }

    revalidateUsers();
    return { ok: true, data: mapPlatformUser(profile, parsed.data.email) };
  } catch {
    return failure("INTERNAL_ERROR", "Unable to create the user right now.");
  }
}

export async function updateUser(input: UpdateManagedUserInput): Promise<ServerResult<PlatformUser>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;

  const parsed = updateManagedUserSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  let period: ReturnType<typeof calculateActivationPeriod>;
  try {
    period = calculateActivationPeriod(
      parsed.data.activationStartDate,
      parsed.data.role,
      parsed.data.activationMonths,
    );
  } catch {
    return validationFailure({ activationStartDate: ["Choose a valid activation period."] });
  }

  try {
    const admin = createAdminClient();
    const target = await getManagedProfile(admin, parsed.data.userId);
    if (!target.ok) return target;

    const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(parsed.data.userId);
    const originalEmail = authData.user?.email;
    if (authLookupError || !originalEmail) return failure("NOT_FOUND", "The Auth identity was not found.");

    const emailChanged = originalEmail.toLocaleLowerCase() !== parsed.data.email.toLocaleLowerCase();
    if (emailChanged) {
      const { error: emailError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
        email: parsed.data.email,
      });
      if (emailError) return authMutationFailure(emailError.message, "Unable to update the email address.");
    }

    const now = new Date().toISOString();
    const wasEffectivelyActive = target.data.status === "ACTIVE"
      && (target.data.role === "ADMIN" || Boolean(target.data.expiration_date && target.data.expiration_date > now));
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
        age: parsed.data.age,
        gender: toDatabaseGender(parsed.data.gender),
        home_address: parsed.data.homeAddress || null,
        role: toDatabaseRole(parsed.data.role),
        status: toDatabaseStatus(parsed.data.status),
        activation_start: period.activationStart,
        activation_months: period.activationMonths,
        expiration_date: period.expirationDate,
        deactivated_at: parsed.data.status === "inactive" && target.data.status !== "INACTIVE"
          ? now
          : target.data.deactivated_at,
        reactivated_at: parsed.data.status === "active" && !wasEffectivelyActive
          ? now
          : target.data.reactivated_at,
      })
      .eq("id", parsed.data.userId)
      .select("*")
      .single();

    if (profileError || !profile) {
      if (emailChanged) {
        const { error: rollbackError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
          email: originalEmail,
        });
        if (rollbackError) console.error("[admin-users] Failed to roll back an email update.");
      }
      return failure("INTERNAL_ERROR", "Unable to update the user profile.");
    }

    revalidateUsers();
    return { ok: true, data: mapPlatformUser(profile, parsed.data.email) };
  } catch {
    return failure("INTERNAL_ERROR", "Unable to update the user right now.");
  }
}

export async function deactivateUser(input: UserIdInput): Promise<ServerResult<PlatformUser>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  try {
    const admin = createAdminClient();
    const target = await getManagedProfile(admin, parsed.data.userId);
    if (!target.ok) return target;

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(parsed.data.userId);
    if (authError || !authData.user?.email) return failure("NOT_FOUND", "The Auth identity was not found.");

    const { data: profile, error } = await admin
      .from("profiles")
      .update({ status: "INACTIVE", deactivated_at: new Date().toISOString() })
      .eq("id", parsed.data.userId)
      .select("*")
      .single();
    if (error || !profile) return failure("INTERNAL_ERROR", "Unable to deactivate the user.");

    revalidateUsers();
    return { ok: true, data: mapPlatformUser(profile, authData.user.email) };
  } catch {
    return failure("INTERNAL_ERROR", "Unable to deactivate the user right now.");
  }
}

export async function reactivateStudent(input: UserIdInput): Promise<ServerResult<PlatformUser>> {
  return reactivateUser(input, "student", 1);
}

export async function reactivateTeacher(input: ReactivateTeacherInput): Promise<ServerResult<PlatformUser>> {
  const parsed = reactivateTeacherSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);
  return reactivateUser(parsed.data, "teacher", parsed.data.activationMonths);
}

async function reactivateUser(
  input: UserIdInput,
  expectedRole: "student" | "teacher",
  activationMonths: number,
): Promise<ServerResult<PlatformUser>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

  try {
    const admin = createAdminClient();
    const target = await getManagedProfile(admin, parsed.data.userId);
    if (!target.ok) return target;
    if (toManagedRole(target.data.role) !== expectedRole) {
      return failure("CONFLICT", `This account is not a ${expectedRole}.`);
    }

    const period = calculateActivationPeriod(getServerDate(), expectedRole, activationMonths);
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(parsed.data.userId);
    if (authError || !authData.user?.email) return failure("NOT_FOUND", "The Auth identity was not found.");

    const { data: profile, error } = await admin
      .from("profiles")
      .update({
        status: "ACTIVE",
        activation_start: period.activationStart,
        activation_months: period.activationMonths,
        expiration_date: period.expirationDate,
        reactivated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.userId)
      .select("*")
      .single();
    if (error || !profile) return failure("INTERNAL_ERROR", "Unable to reactivate the user.");

    revalidateUsers();
    return { ok: true, data: mapPlatformUser(profile, authData.user.email) };
  } catch {
    return failure("INTERNAL_ERROR", "Unable to reactivate the user right now.");
  }
}

async function getManagedProfile(admin: AdminClient, userId: string): Promise<ServerResult<ProfileRow>> {
  const { data, error } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return failure("INTERNAL_ERROR", "Unable to load the user profile.");
  if (!data || data.role === "ADMIN") return failure("NOT_FOUND", "The managed user was not found.");
  return { ok: true, data };
}

async function listAllAuthUsers(admin: AdminClient): Promise<readonly User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

function mapPlatformUser(profile: ProfileRow, email: string): PlatformUser {
  return {
    id: profile.id,
    fullName: profile.full_name,
    email,
    phone: profile.phone,
    age: profile.age,
    gender: profile.gender === "MALE" ? "male" : profile.gender === "FEMALE" ? "female" : null,
    homeAddress: profile.home_address,
    role: toManagedRole(profile.role),
    status: profile.status === "INACTIVE" ? "inactive" : profile.status === "EXPIRED" ? "expired" : "active",
    activationStartDate: toDateOnly(profile.activation_start),
    activationMonths: profile.activation_months,
    expirationDate: toDateOnly(profile.expiration_date),
    createdBy: profile.created_by,
    deactivatedAt: profile.deactivated_at,
    reactivatedAt: profile.reactivated_at,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function toDateOnly(value: string | null): string | null {
  return value?.slice(0, 10) ?? null;
}

function toDatabaseRole(role: "student" | "teacher"): "STUDENT" | "TEACHER" {
  return role === "student" ? "STUDENT" : "TEACHER";
}

function toManagedRole(role: ProfileRow["role"]): "student" | "teacher" {
  if (role === "ADMIN") throw new Error("Admin profiles are not managed by this feature.");
  return role === "STUDENT" ? "student" : "teacher";
}

function toDatabaseStatus(status: "active" | "inactive"): "ACTIVE" | "INACTIVE" {
  return status === "active" ? "ACTIVE" : "INACTIVE";
}

function toDatabaseGender(gender: PlatformUserInput["gender"]): ProfileRow["gender"] {
  if (gender === null) return null;
  return gender === "male" ? "MALE" : "FEMALE";
}

function invitationRedirectUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
  const redirect = new URL("/auth/callback", siteUrl);
  redirect.searchParams.set("next", "/login/update-password");
  return redirect.toString();
}

function authMutationFailure(providerMessage: string | undefined, fallback: string): ServerResult<never> {
  const normalized = providerMessage?.toLocaleLowerCase() ?? "";
  if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "An account with this email address already exists.",
        fieldErrors: { email: ["This email address is already in use."] },
      },
    };
  }
  return failure("INTERNAL_ERROR", fallback);
}

function validationFailure(fieldErrors: Record<string, string[] | undefined>): ServerResult<never> {
  const normalized = Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1])),
  );
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors: normalized,
    },
  };
}

function failure(code: ServerErrorCode, message: string): ServerResult<never> {
  return { ok: false, error: { code, message } };
}

function revalidateUsers(): void {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}
