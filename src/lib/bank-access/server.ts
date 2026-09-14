import "server-only";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";
import type { AdminAccessRequest, RecordedAnswer, StudentBank, StudentQuestion } from "@/types/bank-access";
import type { QuestionBankStoreData } from "@/types/question-bank";

const studentQuestionSchema = z.object({
  id: z.string(), question_bank_id: z.string(), text: z.string(), status: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
});

export async function getStudentBanks(): Promise<StudentBank[]> {
  const profile = await requireRole("STUDENT");
  const db = await createClient();
  const [banks, requests, grants] = await Promise.all([
    readAllRows((from, to) => db.from("question_banks").select("*").eq("status", "active").order("display_order").order("id").range(from, to)),
    readAllRows((from, to) => db.from("user_bank_access_requests").select("*").eq("user_id", profile.id).order("requested_at", { ascending: false }).order("id").range(from, to)),
    readAllRows((from, to) => db.from("user_bank_access").select("*").eq("user_id", profile.id).eq("status", "ACTIVE").order("id").range(from, to)),
  ]);
  return banks.map((bank) => {
    const request = requests.find((item) => item.question_bank_id === bank.id);
    const approved = grants.some((item) => item.question_bank_id === bank.id);
    return { ...bank, status: "active", accessState: approved ? "APPROVED" : request?.status === "PENDING" || request?.status === "REJECTED" ? request.status : "LOCKED", rejectionReason: request?.rejection_reason ?? null };
  });
}

export async function getStudentCourse(bankId: string) {
  const profile = await requireRole("STUDENT");
  const db = await createClient();
  const { data: grant, error } = await db.from("user_bank_access").select("*").eq("user_id", profile.id).eq("question_bank_id", bankId).eq("status", "ACTIVE").maybeSingle();
  if (error) throw new Error("Unable to verify course access.");
  if (!grant) return null;
  const { data: bank, error: bankError } = await db.from("question_banks").select("*").eq("id", bankId).eq("status", "active").maybeSingle();
  if (bankError) throw new Error("Unable to load course.");
  if (!bank) return null;
  // RLS independently checks enabled student, active grant, active bank and question.
  const [questionsResult, attemptResult] = await Promise.all([
    readAllRows((from, to) => db.from("bank_questions").select("id,question_bank_id,text,status,options").eq("question_bank_id", bankId).eq("status", "active").order("created_at").order("id").range(from, to)),
    db.from("question_attempts").select("id").eq("student_id", profile.id).eq("question_bank_id", bankId).in("status", ["IN_PROGRESS", "COMPLETED"]).order("started_at", { ascending: false }).order("id").limit(1).maybeSingle(),
  ]);
  if (attemptResult.error) throw new Error("Unable to load course progress.");
  const answerResult = attemptResult.data
    ? await readAllRows((from, to) => db.from("question_attempt_answers").select("question_id,selected_option_id,is_correct").eq("attempt_id", attemptResult.data!.id).order("id").range(from, to))
    : [];
  // Parse an explicit allowlist: never serialize extra option/solution properties.
  const safeQuestions: StudentQuestion[] = z.array(studentQuestionSchema).parse(questionsResult);
  const recordedAnswers: RecordedAnswer[] = answerResult.map((answer) => ({
    questionId: answer.question_id,
    selectedOptionId: answer.selected_option_id,
    isCorrect: answer.is_correct,
  }));
  return { bank, questions: safeQuestions, recordedAnswers };
}

export async function getAdminRequests(): Promise<AdminAccessRequest[]> {
  await requireRole("ADMIN");
  const db = await createClient();
  const { data, error } = await db.rpc("list_bank_access_requests");
  if (error) throw new Error("Unable to load access requests.");
  return data as unknown as AdminAccessRequest[];
}

export async function getAdminBankData(): Promise<QuestionBankStoreData> {
  await requireRole("ADMIN");
  const db = await createClient();
  const { data, error } = await db.rpc("admin_bank_data");
  if (error) throw new Error("Unable to load bank content.");
  return data as unknown as QuestionBankStoreData;
}
