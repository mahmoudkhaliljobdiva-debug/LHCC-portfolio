import "server-only";
import { cache } from "react";

import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPreviewContext } from "@/lib/portal-preview/server";
import type { AdminAccessRequest, StudentBank, CoursePackage } from "@/types/bank-access";
import { getLearningCatalog } from "@/lib/learning/server";
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
  const [banks, requests, grants, packageRequests, packageGrants] = await Promise.all([
    // Show every active, admin-published course, even with zero active questions.
    // Actual question/study content remains server-authorized after approval.
    readAllRows((from, to) => db.from("question_banks").select("*").eq("status", "active")
      .eq("publication_status", "PUBLISHED").in("material_kind", ["EXAM_TRACK", "SUBJECT"])
      .order("display_order").order("id").range(from, to)),
    readAllRows((from, to) => db.from("user_bank_access_requests").select("*").eq("user_id", subjectId).order("requested_at", { ascending: false }).order("id").range(from, to)),
    readAllRows((from, to) => db.from("user_bank_access").select("*").eq("user_id", subjectId).order("id").range(from, to)),
    readAllRows((from, to) => db.from("course_package_access_requests").select("*").eq("user_id", subjectId).order("requested_at", { ascending: false }).range(from, to)),
    readAllRows((from, to) => db.from("course_package_access").select("*").eq("user_id", subjectId).order("id").range(from, to)),
  ]);
  // Visibility reflects the admin's Published/Active flags, not the student's
  // existing approval or the number of imported questions.
  return banks.map((bank) => {
    const request = requests.find((item) => item.question_bank_id === bank.id);
    const grant = grants.find((item) => item.question_bank_id === bank.id);
    const packageGrant = packageGrants.find(item => item.specialty_id === bank.specialty_id);
    const packageRequest = packageRequests.find(item => item.specialty_id === bank.specialty_id);
    const packageAccessState = packageGrant?.status === "ACTIVE" ? "APPROVED" as const
      : packageRequest?.status === "PENDING" || packageRequest?.status === "REJECTED"
        ? packageRequest.status : "LOCKED" as const;
    const approved = grant?.status === "ACTIVE" || packageAccessState === "APPROVED";
    return {
      ...bank,
      material_kind: bank.material_kind === "SUBJECT" ? "SUBJECT" as const : "EXAM_TRACK" as const,
      status: "active" as const,
      packageAccessState,
      packageAccessRevoked: packageGrant?.status === "REVOKED",
      packageRejectionReason: packageRequest?.rejection_reason ?? null,
      accessState: approved ? "APPROVED" as const
        : packageAccessState === "PENDING" || packageAccessState === "REJECTED" ? packageAccessState
          : request?.status === "PENDING" || request?.status === "REJECTED" ? request.status
            : "LOCKED" as const,
      accessRevoked: grant?.status === "REVOKED" || packageGrant?.status === "REVOKED",
      rejectionReason: packageRequest?.rejection_reason ?? request?.rejection_reason ?? null,
    };
  });
}


export const getStudentCoursePackages = cache(async (): Promise<CoursePackage[]> => {
  const [catalog, banks] = await Promise.all([getLearningCatalog(), getStudentBanks()]);
  const byId = new Map(banks.map(bank => [bank.id, bank]));
  return catalog.flatMap(specialty => {
    const materials = specialty.materials
      .map(material => byId.get(material.id))
      .filter((bank): bank is StudentBank => Boolean(bank));
    if (!materials.length) return [];
    const first = materials[0];
    const allGranted = materials.every(bank => bank.accessState === "APPROVED");
    const accessState = first.packageAccessState === "APPROVED" || allGranted
      ? "APPROVED" as const : first.packageAccessState;
    return [{
      id: specialty.id,
      slug: specialty.slug,
      name: specialty.slug === "medical" ? "Medicine"
        : specialty.slug === "nursing" && materials.length === 1 ? "Nursing Colloquium"
          : specialty.name,
      description: specialty.description,
      materials,
      accessState,
      accessRevoked: first.packageAccessRevoked,
      rejectionReason: first.packageRejectionReason,
      totalPrice: materials.reduce((sum, bank) => sum + Number(bank.price || 0), 0),
    }];
  });
});

export async function getAdminRequests(): Promise<AdminAccessRequest[]> {
  await requireRole("ADMIN");
  const db = await createClient();
  const [legacy, packages, grants] = await Promise.all([
    db.rpc("list_bank_access_requests"),
    db.rpc("list_course_package_requests"),
    readAllRows((from,to) => db.from("user_bank_access").select("request_id,status").order("id").range(from,to)),
  ]);
  if (legacy.error || packages.error) throw new Error("Unable to load access requests.");
  const legacyRequests = (legacy.data as unknown as AdminAccessRequest[]).map(request => ({
    ...request, kind: "COURSE" as const,
    accessActive: grants.some(grant => grant.request_id === request.id && grant.status === "ACTIVE"),
  }));
  const packageRequests = (packages.data as unknown as AdminAccessRequest[]);
  return [...packageRequests, ...legacyRequests]
    .sort((a,b) => Date.parse(b.requested_at) - Date.parse(a.requested_at));
}

export async function getAdminBankData(): Promise<QuestionBankStoreData> {
  await requireRole("ADMIN");
  const db = await createClient();
  const { data, error } = await db.rpc("admin_bank_data");
  if (error) throw new Error("Unable to load bank content.");
  return data as unknown as QuestionBankStoreData;
}
