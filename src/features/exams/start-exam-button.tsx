"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { startExam } from "@/actions/exams";

export function StartExamButton({ bankId, disabled }: { bankId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState(""); const router = useRouter();
  return <><button disabled={disabled || pending} className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50" onClick={() => startTransition(async () => {
    setError("");
    try { const result = await startExam(bankId);
      if (result.ok) router.push(`/student/exams/${result.data}` as Route); else setError(result.error.message);
    } catch { setError("Unable to start the exam. Please try again."); }
  })}>{pending ? "Starting exam…" : "Start Exam"}</button>{error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}</>;
}
