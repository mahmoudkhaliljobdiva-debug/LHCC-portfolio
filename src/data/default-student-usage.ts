import type { StudentBankUsage } from "@/types/user-management";

export const DEFAULT_STUDENT_BANK_USAGE = [
  { studentId: "student-maya", bankId: "anatomy", questionsViewed: 72, questionsAnswered: 58, correctAnswers: 43, incorrectAnswers: 15, attemptsCount: 7, lastActivityAt: "2026-08-01T13:20:00.000Z" },
  { studentId: "student-maya", bankId: "physiology", questionsViewed: 48, questionsAnswered: 39, correctAnswers: 30, incorrectAnswers: 9, attemptsCount: 5, lastActivityAt: "2026-07-30T10:10:00.000Z" },
  { studentId: "student-maya", bankId: "pathology", questionsViewed: 34, questionsAnswered: 28, correctAnswers: 19, incorrectAnswers: 9, attemptsCount: 4, lastActivityAt: "2026-07-27T16:45:00.000Z" },
  { studentId: "student-maya", bankId: "pharmacology", questionsViewed: 25, questionsAnswered: 20, correctAnswers: 13, incorrectAnswers: 7, attemptsCount: 3, lastActivityAt: "2026-07-24T09:15:00.000Z" },
  { studentId: "student-sarah", bankId: "anatomy", questionsViewed: 63, questionsAnswered: 51, correctAnswers: 38, incorrectAnswers: 13, attemptsCount: 6, lastActivityAt: "2026-08-01T08:40:00.000Z" },
  { studentId: "student-sarah", bankId: "clinical-medicine", questionsViewed: 42, questionsAnswered: 33, correctAnswers: 22, incorrectAnswers: 11, attemptsCount: 4, lastActivityAt: "2026-07-29T14:00:00.000Z" },
  { studentId: "student-noah", bankId: "microbiology", questionsViewed: 18, questionsAnswered: 12, correctAnswers: 8, incorrectAnswers: 4, attemptsCount: 2, lastActivityAt: "2026-07-21T12:30:00.000Z" },
] as const satisfies readonly StudentBankUsage[];
