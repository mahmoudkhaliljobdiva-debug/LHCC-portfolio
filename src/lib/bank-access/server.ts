import "server-only";
import { cache } from "react";

import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPreviewContext } from "@/lib/portal-preview/server";
import type { AdminAccessRequest, StudentBank } from "@/types/bank-access";
import type { QuestionBankStoreData } from "@/types/question-bank";


export const getStudentBanks = cache(async (): Promise<StudentBank[]> => {
  const profile = await requireRole("STUDENT");
  const db = await createClient();
  return readStudentBanks(db, profile.id);
});

export async function getAdminBankOptions(): Promise<readonly { id: string; name: string }[]> {
  await requireRole("ADMIN");
  const db = await createClient();
  return readAllRows((from, to) => db.from("question_banks").select("id,name").order("display_order").order("id").range(from, to));
}

export async function getStudentBanksForAdmin(subjectId: string) {
  const { subject } = await getPortalPreviewContext("student", subjectId);
  return readStudentBanks(createAdminClient(), subject.id);
}

async function readStudentBanks(db: Awaited<ReturnType<typeof createClient>>, subjectId: string): Promise<StudentBank[]> {
  const [banks, requests, grants] = await Promise.all([
    readAllRows((from, to) => db.from("question_banks").select("*").eq("status", "active").order("display_order").order("id").range(from, to)),
    readAllRows((from, to) => db.from("user_bank_access_requests").select("*").eq("user_id", subjectId).order("requested_at", { ascending: false }).order("id").range(from, to)),
    readAllRows((from, to) => db.from("user_bank_access").select("*").eq("user_id", subjectId).order("id").range(from, to)),
  ]);
  return banks.map((bank) => {
    const request = requests.find((item) => item.question_bank_id === bank.id);
    const grant = grants.find((item) => item.question_bank_id === bank.id);
    const approved = grant?.status === "ACTIVE";
    return { ...bank, status: "active", accessState: approved ? "APPROVED" : request?.status === "PENDING" || request?.status === "REJECTED" ? request.status : "LOCKED", accessRevoked: grant?.status === "REVOKED", rejectionReason: request?.rejection_reason ?? null };
  });
}


export async function getAdminRequests(): Promise<AdminAccessRequest[]> {
  await requireRole("ADMIN");
  const db = await createClient();
  const { data, error } = await db.rpc("list_bank_access_requests");
  if (error) throw new Error("Unable to load access requests.");
  const grants = await readAllRows((from,to) => db.from("user_bank_access").select("request_id,status").order("id").range(from,to));
  return (data as unknown as AdminAccessRequest[]).map(request => ({ ...request, accessActive: grants.some(grant => grant.request_id === request.id && grant.status === "ACTIVE") }));
}

export async function getAdminBankData(): Promise<QuestionBankStoreData> {
  await requireRole("ADMIN");
  const db = await createClient();
  const { data, error } = await db.rpc("admin_bank_data");
  if (error) throw new Error("Unable to load bank content.");
  return data as unknown as QuestionBankStoreData;
}
