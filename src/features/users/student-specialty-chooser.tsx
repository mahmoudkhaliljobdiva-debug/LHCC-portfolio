"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, HeartPulse, Stethoscope } from "lucide-react";
import { chooseStudentSpecialty } from "@/actions/student-specialty";
import type { StudentSpecialty } from "@/types/account";

const options = [
  {slug:"dentistry",name:"Dentistry",description:"Dentistry mock examinations",icon:Stethoscope},
  {slug:"medical",name:"Medicine (MD)",description:"Medical subjects and future MD mock exams",icon:BookOpen},
  {slug:"nursing",name:"Nursing",description:"Nursing Colloquium",icon:HeartPulse},
] as const;

export function StudentSpecialtyChooser() {
  const [selected,setSelected] = useState<StudentSpecialty | null>(null);
  const [busy,startTransition] = useTransition();
  const [error,setError] = useState("");
  const router = useRouter();
  function confirm() {
    if (!selected || busy) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await chooseStudentSpecialty(selected);
        if (result.ok) { router.replace("/student"); router.refresh(); }
        else setError(result.error.message);
      } catch { setError("Unable to choose your specialty. Please try again."); }
    });
  }
  return <main className="mx-auto max-w-3xl rounded-3xl border bg-white p-5 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-teal-700">Complete your learning profile</p>
    <h1 className="mt-2 text-2xl font-bold text-slate-950">Choose your specialty</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Your account was created before specialty selection was available. Choose one track to see only its courses and exams. For a later change, please contact LHCC.</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-3">{options.map(option=>{
      const Icon=option.icon;return <button key={option.slug} type="button" aria-pressed={selected===option.slug}
        onClick={()=>setSelected(option.slug)}
        className={`min-h-36 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${selected===option.slug?"border-teal-600 bg-teal-50 ring-2 ring-teal-400/40":"border-slate-200 hover:border-teal-500"}`}>
        <Icon className="size-7 text-teal-700" aria-hidden="true"/>
        <span className="mt-3 block font-semibold text-slate-950">{option.name}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">{option.description}</span>
      </button>;
    })}</div>
    {error && <p role="alert" className="mt-5 text-sm text-rose-700">{error}</p>}
    <button type="button" disabled={!selected || busy} onClick={confirm} className="mt-6 min-h-12 rounded-xl bg-teal-700 px-6 font-semibold text-white disabled:opacity-50">
      {busy ? "Saving…" : "Confirm my specialty"}
    </button>
  </main>;
}
