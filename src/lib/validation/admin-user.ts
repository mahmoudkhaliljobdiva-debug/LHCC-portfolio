import { z } from "zod";

import { MAX_HOME_ADDRESS_LENGTH, MAX_PROFILE_AGE, MIN_PROFILE_AGE } from "@/constants/profile";
import { MAX_TEACHER_ACTIVATION_MONTHS } from "@/lib/users/activation";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid activation date.").refine((value) => {
  const parts = value.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, "Choose a valid activation date.");

export const managedUserSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(200, "Full name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().max(50, "Phone number is too long.").optional().default(""),
  age: z.number().int("Age must be a whole number.").min(MIN_PROFILE_AGE).max(MAX_PROFILE_AGE).nullable(),
  gender: z.enum(["male", "female"]).nullable(),
  homeAddress: z.string().trim().max(MAX_HOME_ADDRESS_LENGTH, "Home address is too long."),
  role: z.enum(["student", "teacher"]),
  status: z.enum(["active", "inactive"]),
  activationStartDate: dateOnlySchema,
  activationMonths: z.number().int().min(1).max(MAX_TEACHER_ACTIVATION_MONTHS),
}).superRefine((input, context) => {
  if (input.role === "student" && input.activationMonths !== 1) {
    context.addIssue({
      code: "custom",
      path: ["activationMonths"],
      message: "Student activation is always one calendar month.",
    });
  }
});

export const updateManagedUserSchema = managedUserSchema.and(z.object({ userId: z.string().uuid() }));
export const userIdSchema = z.object({ userId: z.string().uuid() });
export const reactivateTeacherSchema = userIdSchema.extend({
  activationMonths: z.number().int().min(1).max(MAX_TEACHER_ACTIVATION_MONTHS),
});
