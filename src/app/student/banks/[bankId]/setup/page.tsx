import { notFound } from "next/navigation";
import { getExamBank } from "@/lib/exams/server";
import { ExamSetup } from "@/features/exams/exam-setup";
import type { LearningSetup } from "@/types/past-exam";
export default async function Page({ params,searchParams }: { params: Promise<{ bankId: string }>; searchParams: Promise<{ source?: string; sourceId?: string }> }) {
  const { bankId } = await params; const query = await searchParams; const bank = await getExamBank(bankId); if (!bank) notFound();
  const source = query.source ?? "RANDOM"; if (!["RANDOM","ALL","CASE","PAST","SHARED","CHAPTER"].includes(source)) notFound();
  const chapter = source === "CHAPTER" ? bank.chapters.find(c => c.id === query.sourceId) : null;
  if (source === "CHAPTER" && !chapter) notFound();
  const past = source === "PAST" ? bank.pastExams.find(e => e.id===query.sourceId) : null; const clinical = source === "CASE" ? bank.cases.find(c => c.id===query.sourceId) : null;
  const shared = source === "SHARED" ? bank.sharedExams.find(e=>e.id===query.sourceId) : null;
  if ((source === "PAST" && !past) || (source === "CASE" && !clinical) || (source === "SHARED" && !shared)) notFound();
  const initial: LearningSetup = { bankId,source:source as LearningSetup["source"],sourceId:past?.id ?? clinical?.id ?? shared?.id ?? chapter?.id ?? null,mode:["ALL","CASE","CHAPTER"].includes(source) ? "PRACTICE" : "EXAM",count:Math.max(1,Math.min(bank.generation.defaultCount,bank.examCount)),timeLimitMinutes:past?.timeLimitMinutes ?? shared?.timeLimitMinutes ?? null,
    ...(source === "RANDOM" ? { prioritizeIncorrect: bank.generation.prioritizeIncorrect } : {}) };
  return <ExamSetup initial={initial} title={past?.title ?? clinical?.title ?? shared?.title ?? chapter?.title ?? (source === "ALL" ? "Complete Question Bank" : "AI-Generated Exam")} year={past?.year ?? null} available={past?.questionCount ?? clinical?.questionCount ?? shared?.questionCount ?? chapter?.questionCount ?? bank.available} />;
}
