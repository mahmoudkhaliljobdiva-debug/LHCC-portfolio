import { notFound } from "next/navigation";
import { getExamBank } from "@/lib/exams/server";
import { PastExamArchive } from "@/features/exams/past-exam-archive";
export default async function Page({ params }: { params: Promise<{ bankId: string }> }) { const { bankId } = await params; const bank = await getExamBank(bankId); if (!bank) notFound(); return <PastExamArchive bank={bank} />; }
