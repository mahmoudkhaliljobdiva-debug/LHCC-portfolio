import { notFound } from "next/navigation";
import { getExamBank } from "@/lib/exams/server";
import { SharedExamList } from "@/features/learning/shared-exam-list";
export default async function Page({params}:{params:Promise<{bankId:string}>}) {const {bankId}=await params;const bank=await getExamBank(bankId);if(!bank)notFound();return <SharedExamList bank={bank}/>;}
