import type { PlatformUser } from "@/types/user-management";
import { addCalendarMonths, getTodayDate } from "@/utils/user-activation";

export function createDefaultUsers(): readonly PlatformUser[] {
  const today = getTodayDate();
  const sixMonthsAgo = addCalendarMonths(today, -6);
  const oneMonthAgo = addCalendarMonths(today, -1);
  const inOneMonth = addCalendarMonths(today, 1);
  const inSixMonths = addCalendarMonths(today, 6);
  const inTwelveMonths = addCalendarMonths(today, 12);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 5);
  const expiringSoon = getTodayDate(sevenDaysFromNow);
  const now = new Date().toISOString();

  return [
    { id: "student-maya", fullName: "Maya Carter", email: "maya@example.edu", role: "student", status: "active", activationStartDate: today, activationMonths: 1, expirationDate: inOneMonth, createdAt: now, updatedAt: now },
    { id: "student-sarah", fullName: "Sarah Ahmad", email: "sarah@example.com", role: "student", status: "active", activationStartDate: today, activationMonths: 1, expirationDate: inOneMonth, createdAt: now, updatedAt: now },
    { id: "student-noah", fullName: "Noah Williams", email: "noah@example.edu", role: "student", status: "active", activationStartDate: oneMonthAgo, activationMonths: 1, expirationDate: expiringSoon, createdAt: now, updatedAt: now },
    { id: "student-amelia", fullName: "Amelia Clark", email: "amelia@example.edu", role: "student", status: "inactive", activationStartDate: oneMonthAgo, activationMonths: 1, expirationDate: today, createdAt: now, updatedAt: now },
    { id: "teacher-daniel", fullName: "Dr. Daniel Harris", email: "daniel@example.edu", role: "teacher", status: "active", activationStartDate: today, activationMonths: 12, expirationDate: inTwelveMonths, createdAt: now, updatedAt: now },
    { id: "teacher-sophia", fullName: "Dr. Sophia Lee", email: "sophia@example.edu", role: "teacher", status: "active", activationStartDate: sixMonthsAgo, activationMonths: 12, expirationDate: inSixMonths, createdAt: now, updatedAt: now },
  ];
}
