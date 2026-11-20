import { z } from "zod";
import { MAX_HOME_ADDRESS_LENGTH, MAX_PROFILE_AGE, MIN_PROFILE_AGE } from "@/constants/profile";
import { isCountryCode, normalizePhoneNumber } from "@/lib/phone";

export const ownProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(200),
  countryCode: z.string().refine(isCountryCode, "Select a valid country.").nullable(),
  phone: z.string().trim().min(1).max(30).nullable(),
  age: z.number().int().min(MIN_PROFILE_AGE).max(MAX_PROFILE_AGE).nullable(),
  gender: z.enum(["male", "female"]).nullable(),
  homeAddress: z.string().trim().max(MAX_HOME_ADDRESS_LENGTH).nullable(),
}).strict().superRefine((value, context) => {
  if (value.phone && (!value.countryCode || !isCountryCode(value.countryCode) || !normalizePhoneNumber(value.phone, value.countryCode))) {
    context.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number and select its country." });
  }
});
