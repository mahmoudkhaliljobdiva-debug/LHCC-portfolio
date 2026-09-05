import type { EffectiveUserStatus, PlatformUser } from "@/types/user-management";

export function getTodayDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarMonths(dateValue: string, months: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day || !Number.isInteger(months)) throw new Error("Invalid activation date or month duration");
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const finalDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const validDay = Math.min(day, finalDay);
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(validDay).padStart(2, "0")}`;
}

export function getEffectiveUserStatus(user: PlatformUser, currentDate = getTodayDate()): EffectiveUserStatus {
  if (user.status === "inactive") return "inactive";
  if (!user.expirationDate) return "expired";
  if (user.expirationDate <= currentDate) return "expired";
  const remaining = getRemainingDays(user.expirationDate, currentDate);
  return remaining <= 7 ? "expiring-soon" : "active";
}

export function getRemainingDays(expirationDate: string, currentDate = getTodayDate()): number {
  const expiration = new Date(`${expirationDate}T00:00:00.000Z`).getTime();
  const current = new Date(`${currentDate}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.ceil((expiration - current) / 86_400_000));
}
