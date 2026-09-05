import "server-only";

import type { ManagedUserRole } from "@/types/user-management";
import { addCalendarMonths } from "@/utils/user-activation";

export const MAX_TEACHER_ACTIVATION_MONTHS = 36;

interface ActivationPeriod {
  readonly activationStart: string;
  readonly activationMonths: number;
  readonly expirationDate: string;
}

export function getServerDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function calculateActivationPeriod(
  startDate: string,
  role: ManagedUserRole,
  requestedMonths: number,
): ActivationPeriod {
  const source = parseDateOnly(startDate);
  const months = role === "student" ? 1 : requestedMonths;

  if (!Number.isInteger(months) || months < 1 || months > MAX_TEACHER_ACTIVATION_MONTHS) {
    throw new Error("Invalid activation duration.");
  }

  const expiration = parseDateOnly(addCalendarMonths(startDate, months));

  return {
    activationStart: new Date(Date.UTC(source.year, source.month - 1, source.day)).toISOString(),
    activationMonths: months,
    expirationDate: new Date(Date.UTC(expiration.year, expiration.month - 1, expiration.day)).toISOString(),
  };
}

function parseDateOnly(value: string): { readonly year: number; readonly month: number; readonly day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid activation date.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid activation date.");
  }

  return { year, month, day };
}
