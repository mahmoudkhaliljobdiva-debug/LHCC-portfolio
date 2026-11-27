"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, BookOpen, ChevronDown, CircleCheck, Clock3, Layers3, LockKeyhole } from "lucide-react";
import { requestCoursePackageAccess } from "@/actions/bank-access";
import { formatAccessPrice } from "@/utils/access-price";
import type { CoursePackage } from "@/types/bank-access";

const stateLabels = {
  LOCKED: "Request access",
  PENDING: "Pending approval",
  APPROVED: "Access granted",
  REJECTED: "Request rejected",
} as const;

export function CoursePackageGrid({
  packages,
  expanded = false,
}: {
  readonly packages: readonly CoursePackage[];
  readonly expanded?: boolean;
}) {
  if (!packages.length) {
    return <p className="rounded-2xl border bg-white p-6 text-slate-600">No published course packages are available.</p>;
  }
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {packages.map(pkg => <CoursePackageCard key={`${pkg.id}:${pkg.accessState}:${pkg.accessRevoked}`} pkg={pkg} expanded={expanded} />)}
  </div>;
}

function CoursePackageCard({ pkg, expanded }: { readonly pkg: CoursePackage; readonly expanded: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const approved = pkg.accessState === "APPROVED";
  const packageRoute = `/student/specialties/${pkg.slug}` as Route;

  function request() {
    startTransition(async () => {
      try {
        const result = await requestCoursePackageAccess(pkg.id);
        setFailed(!result.ok);
        setFeedback(result.ok ? "Your package request was sent to LHCC for approval." : result.error.message);
        if (result.ok) router.refresh();
      } catch {
        setFailed(true);
        setFeedback("Unable to send package request. Please try again.");
      }
    });
  }

  return <article className="learning-card lhcc-card-stack flex h-full min-w-0 flex-col rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <span className="learning-icon grid size-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
        <Layers3 className="size-6" aria-hidden="true" />
      </span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${approved ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
        {stateLabels[pkg.accessState]}
      </span>
    </div>
    <div className="mt-5 flex-1">
      <h3 dir="auto" className="break-words text-xl font-semibold text-slate-950">{pkg.name}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {pkg.materials.length} {pkg.materials.length === 1 ? "course" : "subjects"} included
        {pkg.description ? ` · ${pkg.description}` : ""}
      </p>
      {approved && <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CircleCheck className="size-4" aria-hidden="true" />All included material is available
      </p>}
      {pkg.accessState === "PENDING" && <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <Clock3 className="size-4" aria-hidden="true" />Awaiting admin approval
      </p>}
      {pkg.accessState === "LOCKED" && <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <LockKeyhole className="size-4" aria-hidden="true" />Study content is locked until approved
      </p>}
      {pkg.accessRevoked && !approved && <p className="mt-2 text-sm text-slate-600">Previous package access was revoked.</p>}
      {pkg.accessState === "REJECTED" && pkg.rejectionReason && <p className="mt-3 text-sm text-slate-600">Reason: {pkg.rejectionReason}</p>}
      <details className="mt-4 rounded-xl border border-slate-200 p-3" open={expanded ? true : undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
          <span>Included {pkg.materials.length === 1 ? "course" : "subjects"} ({pkg.materials.length})</span>
          <ChevronDown className="size-4" aria-hidden="true" />
        </summary>
        <ul className="mt-3 space-y-2 border-t pt-3">
          {pkg.materials.map(material => <li key={material.id} className="flex items-center gap-2 text-sm text-slate-700">
            <BookOpen className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            {material.accessState === "APPROVED"
              ? <Link className="font-medium text-teal-700 hover:underline" href={`/student/${material.material_kind === "SUBJECT" ? "medical" : "banks"}/${material.id}` as Route}>{material.name}</Link>
              : <span dir="auto" className="break-words">{material.name}</span>}
          </li>)}
        </ul>
      </details>
      <p className="mt-4 text-sm font-semibold text-slate-800">{formatAccessPrice(pkg.totalPrice)}</p>
      {feedback && <p role={failed ? "alert" : "status"} className={`mt-3 text-sm ${failed ? "text-rose-700" : "text-teal-700"}`}>{feedback}</p>}
    </div>
    <div className="lhcc-card-footer mt-5 border-t pt-4">
      {approved
        ? <Link href={packageRoute} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">
            Open Package <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        : <button type="button" onClick={request} disabled={pending || pkg.accessState === "PENDING"} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Sending…" : pkg.accessState === "PENDING" ? "Pending Approval" : pkg.accessState === "REJECTED" ? "Request Again" : "Request Package Access"}
          </button>}
    </div>
  </article>;
}
