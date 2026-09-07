import "server-only";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { AdminAccessRequest, StudentBank, StudentQuestion } from "@/types/bank-access";
import type { QuestionBankStoreData } from "@/types/question-bank";

const studentQuestionSchema = z.object({
  id: z.string(), question_bank_id: z.string(), text: z.string(), status: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
});

export async function getStudentBanks(): Promise<StudentBank[]> {
  const profile = await requireRole("STUDENT");
  const db = await createClient();
  const [banks, requests, grants] = await Promise.all([
    db.from("question_banks").select("*").eq("status", "active").order("display_order"),
    db.from("user_bank_access_requests").select("*").eq("user_id", profile.id).order("requested_at", { ascending: false }),
    db.from("user_bank_access").select("*").eq("user_id", profile.id).eq("status", "ACTIVE"),
  ]);
  if (banks.error || requests.error || grants.error) throw new Error("Unable to load courses. Please try again.");
  return (banks.data ?? []).map((bank) => {
    const request = requests.data?.find((item) => item.question_bank_id === bank.id);
    const approved = grants.data?.some((item) => item.question_bank_id === bank.id);
    return { ...bank, accessState: approved ? "APPROVED" : request?.status === "PENDING" || request?.status === "REJECTED" ? request.status : "LOCKED", rejectionReason: request?.rejection_reason ?? null };
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
  const { data: questions, error: questionError } = await db.from("bank_questions").select("id,question_bank_id,text,status,options").eq("question_bank_id", bankId).eq("status", "active").order("created_at");
  if (questionError) throw new Error("Unable to load questions.");
  // Parse an explicit allowlist: never serialize extra option/solution properties.
  const safeQuestions: StudentQuestion[] = z.array(studentQuestionSchema).parse(questions ?? []);
  return { bank, questions: safeQuestions };
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
