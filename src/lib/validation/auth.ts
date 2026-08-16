import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
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
