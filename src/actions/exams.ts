"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedProfile, getEffectiveProfileStatus } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { contentId, examId } from "@/lib/validation/exam";
import { learningSetupSchema } from "@/lib/validation/past-exam";
import { examSchema } from "@/lib/validation/exam";
import type { ServerResult } from "@/types/server-result";

const failure = (message: string): ServerResult<never> => ({ ok: false, error: { code: "FORBIDDEN", message } });
export async function startLearningExam(input: unknown): Promise<ServerResult<string>> {
  const parsed = learningSetupSchema.safeParse(input);
  if (!parsed.success || !await authorized()) return failure("Check the exam setup and active bank access.");
  const db = await createClient(); const { data, error } = await db.rpc("start_learning_exam", { config: parsed.data });
  if (error || !data) return failure(error?.code === "23514" ? "Continue your unfinished attempt first, or check available questions and setup." : "This exam is not available. Check your approved access.");
  revalidatePath("/student", "layout"); return { ok: true, data };
}
export async function checkPracticeAnswer(attemptId: string, questionId: string): Promise<ServerResult<{ outcome: boolean; correctOptionId: string }>> {
  if (!examId.safeParse(attemptId).success || !contentId.safeParse(questionId).success || !await authorized()) return failure("Active student access is required.");
  const db = await createClient(); const { data, error } = await db.rpc("check_practice_answer", { attempt_id: attemptId, question_id: questionId });
  const parsed = z.object({ outcome: z.boolean(), correctOptionId: contentId }).safeParse(data);
  if (error || !parsed.success) return failure("Save your answer first. Only an active practice attempt allows checking.");
  revalidatePath(`/student/exams/${attemptId}`); return { ok: true, data: parsed.data };
}
async function authorized() {
  const profile = await getAuthenticatedProfile();
  return profile?.role === "STUDENT" && await getEffectiveProfileStatus(profile) === "ACTIVE";
}
export async function startExam(bankId: string): Promise<ServerResult<string>> {
  try {
    if (!contentId.safeParse(bankId).success || !await authorized()) return failure("Active student access is required.");
    const db = await createClient();
    const { data, error } = await db.rpc("start_exam", { bank_id: bankId });
    if (error || !data) return failure("Unable to start this exam. Check bank access and available questions.");
    revalidatePath("/student", "layout");
    return { ok: true, data };
  } catch { return failure("Unable to start the exam. Please try again."); }
}
export async function readCurrentExam(attemptId: string) {
  if (!examId.safeParse(attemptId).success || !await authorized()) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("exam_data", { attempt_id: attemptId });
  return error ? null : examSchema.parse(data);
}
export async function saveExamAnswer(input: { attemptId: string; questionId: string; optionId: string; expectedVersion: number }): Promise<ServerResult<number>> {
  try {
    const parsed = z.object({ attemptId: examId, questionId: contentId, optionId: contentId, expectedVersion: z.number().int().min(0) }).strict().safeParse(input);
    if (!parsed.success || !await authorized()) return failure("Active student access is required.");
    const db = await createClient();
    const { data, error } = await db.rpc("save_exam_answer_versioned", { attempt_id: parsed.data.attemptId, question_id: parsed.data.questionId, option_id: parsed.data.optionId, expected_version: parsed.data.expectedVersion });
    if (error?.code === "40001") return { ok: false, error: { code: "CONFLICT", message: "Another tab changed this exam. Load the latest saved answers before choosing again; your change was not applied." } };
    if (error) return failure("Answer not saved. Your exam may be completed or access may no longer be available. Retry or reload to check.");
    revalidatePath(`/student/exams/${parsed.data.attemptId}`);
    revalidatePath("/student");
    revalidatePath("/student/analytics");
    return { ok: true, data: data! };
  } catch { return failure("Answer not saved. Please retry before leaving this page."); }
}
export async function submitExam(attemptId: string): Promise<ServerResult<string>> {
  try {
    if (!examId.safeParse(attemptId).success || !await authorized()) return failure("Active student access is required.");
    const db = await createClient();
    const { data, error } = await db.rpc("submit_exam", { attempt_id: attemptId });
    if (error || !data) return failure("Unable to submit. Check your exam access and try again.");
    // Keep the submitting form mounted until its response navigates to results.
    // Revalidating its entire layout can stream a completed-page redirect first.
    revalidatePath(`/student/exams/${attemptId}/result`);
    revalidatePath("/student"); revalidatePath("/student/exams"); revalidatePath("/student/analytics");
    revalidatePath("/admin", "layout");
    return { ok: true, data };
  } catch { return failure("Submission failed. Your saved answers are retained; please retry."); }
}
