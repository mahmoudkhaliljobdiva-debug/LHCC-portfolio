"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {setAdminStudentSpecialty} from "@/actions/admin-student-specialty";
type Specialty={id:string;slug:string;name:string};
export function AdminStudentSpecialtyForm({userId,fullName,current,specialties}:{
  userId:string;fullName:string;current:string|null;specialties:readonly Specialty[];
}){
  const router=useRouter();
  const [value,setValue]=useState(specialties.find(s=>s.id===current)?.slug ?? "");
  const [busy,startTransition]=useTransition();
  const [error,setError]=useState("");
  return <form className="mx-auto max-w-xl space-y-5 rounded-2xl border bg-white p-6 shadow-sm sm:p-8"
    onSubmit={event=>{event.preventDefault();setError("");startTransition(async()=>{
      try{const r=await setAdminStudentSpecialty({userId,specialty:value});
        if(!r.ok){setError(r.error.message);return;}
        router.replace("/admin/users");router.refresh();
      }catch{setError("Could not update the specialty. Please retry.");}
    });}}>
    <h1 className="text-2xl font-semibold text-slate-950">Student specialty</h1>
    <p className="text-sm text-slate-600">Assign one study field to <strong>{fullName}</strong>. Only that specialty will be accessible to the student.</p>
    <label className="grid gap-2 text-sm font-medium text-slate-700">Assigned specialty
      <select required value={value} onChange={e=>setValue(e.target.value)}
        className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900">
        <option value="" disabled>Select specialty</option>
        {specialties.map(s=><option key={s.id} value={s.slug}>{s.slug==="medical"?"Medicine (MD)":s.name}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button disabled={busy || !value} className="min-h-11 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Save specialty"}</button>
      <button type="button" disabled={busy} onClick={()=>router.back()} className="min-h-11 rounded-xl border px-5 text-sm font-semibold text-slate-700">Back</button>
    </div>
  </form>;
}
