import { notFound } from "next/navigation";
import { getExamBank } from "@/lib/exams/server";
import { ExamSetup } from "@/features/exams/exam-setup";
import type { LearningSetup } from "@/types/past-exam";
export default async function Page({ params,searchParams }: { params: Promise<{ bankId: string }>; searchParams: Promise<{ source?: string; sourceId?: string }> }) {
  const { bankId } = await params; const query = await searchParams; const bank = await getExamBank(bankId); if (!bank) notFound();
  const source = query.source ?? "RANDOM"; if (!["RANDOM","ALL","CASE","PAST"].includes(source)) notFound();
  const past = source === "PAST" ? bank.pastExams.find(e => e.id===query.sourceId) : null; const clinical = source === "CASE" ? bank.cases.find(c => c.id===query.sourceId) : null;
  if ((source === "PAST" && !past) || (source === "CASE" && !clinical)) notFound();
  const initial: LearningSetup = { bankId,source:source as LearningSetup["source"],sourceId:past?.id ?? clinical?.id ?? null,mode:source === "ALL" || source === "CASE" ? "PRACTICE" : "EXAM",count:Math.max(1,bank.examCount),timeLimitMinutes:past?.timeLimitMinutes ?? null };
  return <ExamSetup initial={initial} title={past?.title ?? clinical?.title ?? (source === "ALL" ? "Complete Question Bank" : "Random Question Bank Exam")} year={past?.year ?? null} available={past?.questionCount ?? clinical?.questionCount ?? bank.available} />;
}
