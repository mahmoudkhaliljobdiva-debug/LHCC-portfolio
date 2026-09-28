"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedProfile, getEffectiveProfileStatus } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { contentId, examId } from "@/lib/validation/exam";
import type { ServerResult } from "@/types/server-result";

const failure = (message: string): ServerResult<never> => ({ ok: false, error: { code: "FORBIDDEN", message } });
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
export async function saveExamAnswer(input: { attemptId: string; questionId: string; optionId: string }): Promise<ServerResult<null>> {
  try {
    const parsed = z.object({ attemptId: examId, questionId: contentId, optionId: contentId }).strict().safeParse(input);
    if (!parsed.success || !await authorized()) return failure("Active student access is required.");
    const db = await createClient();
    const { error } = await db.rpc("save_exam_answer", { attempt_id: parsed.data.attemptId, question_id: parsed.data.questionId, option_id: parsed.data.optionId });
    if (error) return failure("Answer not saved. Your exam may be completed or access may no longer be available. Retry or reload to check.");
    revalidatePath(`/student/exams/${parsed.data.attemptId}`);
    revalidatePath("/student");
    revalidatePath("/student/analytics");
    return { ok: true, data: null };
  } catch { return failure("Answer not saved. Please retry before leaving this page."); }
}
export async function submitExam(attemptId: string): Promise<ServerResult<string>> {
  try {
    if (!examId.safeParse(attemptId).success || !await authorized()) return failure("Active student access is required.");
    const db = await createClient();
    const { data, error } = await db.rpc("submit_exam", { attempt_id: attemptId });
    if (error || !data) return failure("Unable to submit. Check your exam access and try again.");
    revalidatePath("/student", "layout"); revalidatePath("/admin", "layout");
    return { ok: true, data };
  } catch { return failure("Submission failed. Your saved answers are retained; please retry."); }
}
