import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const studentRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(200, "Full name must be 200 characters or fewer."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters.").max(72, "Password must contain 72 characters or fewer."),
  confirmPassword: z.string().min(1, "Confirm your password."),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
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
