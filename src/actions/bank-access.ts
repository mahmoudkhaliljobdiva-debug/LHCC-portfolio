"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { getAuthenticatedProfile, getEffectiveProfileStatus } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { ServerResult } from "@/types/server-result";
import type { AnswerSubmission } from "@/types/bank-access";

const idSchema = z.string().trim().min(1).max(200);
const answerSubmissionSchema = z.object({
  correct: z.boolean(),
  attemptId: z.uuid(),
  completed: z.boolean(),
  scorePercentage: z.coerce.number().min(0).max(100),
});
const failure = (message: string): ServerResult<never> => ({ ok: false, error: { code: "FORBIDDEN", message } });

async function studentAuthorized() {
  const profile = await getAuthenticatedProfile();
  return profile?.role === "STUDENT" && await getEffectiveProfileStatus(profile) === "ACTIVE";
}

export async function requestBankAccess(bankId: string): Promise<ServerResult<null>> {
  try {
    if (!idSchema.safeParse(bankId).success || !await studentAuthorized()) return failure("Sign in with an enabled student account.");
    const db = await createClient();
    const { error } = await db.rpc("request_bank_access", { bank_id: bankId });
    if (error) return failure(error.code === "23505" ? "A request is already pending. Refresh to see its status." : "Unable to request access. The course may be unavailable or already approved.");
    refreshAccess();
    return { ok: true, data: null };
  } catch { return failure("Unable to request access. Please try again."); }
}

async function review(requestId: string, decision: "APPROVED" | "REJECTED", reason: string | null): Promise<ServerResult<null>> {
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().max(1000).nullable() }).safeParse({ id: requestId, reason });
  if (!parsed.success) return failure("Check the request and rejection reason.");
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  try {
    const db = await createClient();
    // The RPC repeats admin authorization using auth.uid(), then atomically reviews/grants.
    const args = parsed.data.reason
      ? { request_id: parsed.data.id, decision, reason: parsed.data.reason }
      : { request_id: parsed.data.id, decision };
    const { error } = await db.rpc("review_bank_access", args);
    if (error) return failure("Unable to review this request. It may already be reviewed, or the student/course is unavailable.");
    refreshAccess();
    return { ok: true, data: null };
  } catch { return failure("Unable to review request. Please try again."); }
}

export async function approveBankAccessRequest(requestId: string) { return review(requestId, "APPROVED", null); }
export async function rejectBankAccessRequest(requestId: string, reason: string) { return review(requestId, "REJECTED", reason); }

export async function submitBankAnswer(questionId: string, optionId: string): Promise<ServerResult<AnswerSubmission>> {
  try {
    if (!idSchema.safeParse(questionId).success || !idSchema.safeParse(optionId).success || !await studentAuthorized()) return failure("Student access required.");
    const db = await createClient();
    const { data, error } = await db.rpc("submit_bank_answer", { question_id: questionId, option_id: optionId });
    if (error) return failure("Unable to submit this answer. Check your course access and try again.");
    const parsed = answerSubmissionSchema.safeParse(data);
    if (!parsed.success) return failure("Unable to read the saved answer result.");
    revalidatePath("/student", "layout");
    return { ok: true, data: parsed.data };
  } catch { return failure("Unable to submit your answer."); }
}

function refreshAccess() {
  revalidatePath("/student", "layout");
  revalidatePath("/admin/access-requests");
}
