import { z } from "zod";

import { MAX_HOME_ADDRESS_LENGTH, MAX_PROFILE_AGE, MIN_PROFILE_AGE } from "@/constants/profile";
import { isCountryCode, normalizePhoneNumber } from "@/lib/phone";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const accountRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(200, "Full name must be 200 characters or fewer."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters.").max(72, "Password must contain 72 characters or fewer."),
  confirmPassword: z.string().min(1, "Confirm your password."),
  age: z.number({ error: "Age is required." })
    .int("Age must be a whole number.")
    .min(MIN_PROFILE_AGE, "Age must be greater than 0.")
    .max(MAX_PROFILE_AGE, `Age must be ${MAX_PROFILE_AGE} or younger.`),
  gender: z.enum(["male", "female"], { error: "Select a gender." }),
  homeAddress: z.string().trim().min(1, "Home address is required.").max(
    MAX_HOME_ADDRESS_LENGTH,
    `Home address must be ${MAX_HOME_ADDRESS_LENGTH} characters or fewer.`,
  ),
  countryCode: z.string().trim().refine(isCountryCode, "Select a valid country."),
  phone: z.string().trim().min(1, "Phone number is required.").max(30, "Phone number is too long."),
}).superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirmPassword"] });
  }

  if (isCountryCode(value.countryCode) && !normalizePhoneNumber(value.phone, value.countryCode)) {
    context.addIssue({ code: "custom", message: "Enter a valid phone number for the selected country.", path: ["phone"] });
  }
});

export const passwordRecoverySchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must contain at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});
