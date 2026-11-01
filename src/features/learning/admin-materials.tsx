"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveMaterial } from "@/actions/materials";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Select } from "@/components/ui/select";
import { examCategories, materialIcons, materialLanguages, materialSchema } from "@/lib/validation/material";
import type { AdminMaterialsData, LearningMaterial, MaterialInput, MaterialKind, MaterialSpecialtyOption } from "@/types/material";

const fieldClass = "min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200";
const categoryLabels = { COLLOQUIUM: "Colloquium", PROMETRIC: "Prometric", OTHER: "Other" } as const;
const languageLabels = { auto: "Automatic", ar: "Arabic", en: "English", mixed: "Arabic & English" } as const;
const iconLabels = { book: "Book", brain: "Brain", stethoscope: "Stethoscope", nursing: "Nursing", dentistry: "Dentistry", graduation: "Graduation", clipboard: "Clipboard", other: "Other" } as const;
const foundationNotice = "Subjects remain draft-only. Admins can organize chapters, lessons and private PDFs; Student reading, practice and subject-access rules are not enabled, so subject publishing and activation remain unavailable.";

export function AdminMaterials({ kind, page, items, total, specialties }: AdminMaterialsData & { kind: MaterialKind; page: number }) {
  const [editing, setEditing] = useState<{ value: MaterialInput; isNew: boolean } | null>(null);
  const [feedback, setFeedback] = useState("");
  const isSubject = kind === "SUBJECT";
  const title = isSubject ? "Subjects" : "Exam Tracks";
  const noun = isSubject ? "subject" : "exam track";
  const path = isSubject ? "/admin/subjects" : "/admin/exam-tracks";
  const specialtyNames = new Map(specialties.map(specialty => [specialty.id, specialty.name]));
  const pages = Math.max(1, Math.ceil(total / 20));

  function addMaterial() {
    setFeedback("");
    setEditing({ isNew: true, value: {
      id: crypto.randomUUID(), name: "", description: "", specialtyId: null,
      materialKind: kind, examCategory: isSubject ? null : "OTHER", publicationStatus: "DRAFT",
      icon: "book", language: "auto", displayOrder: 0, status: "inactive",
    } });
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl"><h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{isSubject ? "Create and organize independent subjects by specialty, then manage their chapters, lessons and private PDFs." : "Manage Colloquium, Prometric and other exam tracks. Existing question banks and their exam content remain available through Question Banks."}</p>
      </div>
      <button type="button" onClick={addMaterial} className="min-h-11 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">Add {noun}</button>
    </header>

    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      {isSubject ? foundationNotice : "New exam tracks always start as Draft and Inactive. Save them first, then review their settings and existing Question Banks tools before publishing or activating."}
      <p className="mt-2">This editor does not manage pricing or payments. Existing prices, access approvals and learning content are preserved.</p>
    </div>

    {feedback ? <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100">{feedback}</p> : null}
    <p className="text-sm text-slate-600 dark:text-slate-300">{total} {total === 1 ? noun : title.toLowerCase()} · Page {Math.min(page + 1, pages)} of {pages}</p>

    {items.length === 0 ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-950 dark:text-slate-50">{page > 0 ? "No materials on this page" : `No ${title.toLowerCase()} yet`}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{page > 0 ? "Return to a previous page to view existing materials." : `Add a ${noun} to begin with a private draft.`}</p>
    </section> : <section aria-label={title} className="grid gap-4 lg:grid-cols-2">
      {items.map(material => <article key={material.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3"><span className="grid shrink-0 place-items-center rounded-xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"><MaterialIcon icon={material.icon} className="size-12" /></span>
          <div className="min-w-0 flex-1"><h2 dir="auto" className="break-words text-lg font-semibold text-slate-950 dark:text-slate-50">{material.name}</h2>
            <p dir="auto" className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{material.specialtyId ? specialtyNames.get(material.specialtyId) ?? "Specialty unavailable" : "Unassigned specialty"}</p>
          </div>
        </div>
        <p dir="auto" className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{material.description || "No description provided."}</p>
        <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500 dark:text-slate-400">Publication</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{material.publicationStatus === "DRAFT" ? "Draft" : material.publicationStatus === "PUBLISHED" ? "Published" : "Archived"}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Availability</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{material.status === "active" ? "Active" : "Inactive"}</dd></div>
          {material.examCategory ? <div><dt className="text-slate-500 dark:text-slate-400">Exam category</dt><dd className="mt-1 text-slate-800 dark:text-slate-200">{categoryLabels[material.examCategory]}</dd></div> : null}
          <div><dt className="text-slate-500 dark:text-slate-400">Language</dt><dd className="mt-1 text-slate-800 dark:text-slate-200">{languageLabels[material.language]}</dd></div>
        </dl>
        <div className="mt-auto flex flex-wrap gap-3 pt-2"><button type="button" className={secondaryButton} onClick={() => { setFeedback(""); setEditing({ value: material, isNew: false }); }}>Edit<span className="sr-only"> {material.name}</span></button>
          {!isSubject ? <Link href={`/admin/question-banks/${encodeURIComponent(material.id)}`} className={secondaryButton}>Manage questions</Link> : <Link href={`/admin/subjects/${encodeURIComponent(material.id)}/lessons`} className={secondaryButton}>Manage chapters & lessons</Link>}
        </div>
      </article>)}
    </section>}

    {page > 0 || (page + 1) * 20 < total ? <nav aria-label={`${title} pagination`} className="flex flex-wrap items-center justify-between gap-3">
      {page > 0 ? <Link className={secondaryButton} href={`${path}?page=${page - 1}`}>Previous page</Link> : <span />}
      {(page + 1) * 20 < total ? <Link className={secondaryButton} href={`${path}?page=${page + 1}`}>Next page</Link> : null}
    </nav> : null}

    {editing ? <MaterialForm key={editing.value.id} initial={editing.value} isNew={editing.isNew} specialties={specialties} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setFeedback("Material saved."); }} /> : null}
  </div>;
}

function MaterialForm({ initial, isNew, specialties, onClose, onSaved }: {
  initial: LearningMaterial; isNew: boolean; specialties: MaterialSpecialtyOption[]; onClose: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<MaterialInput>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const readinessId = useId();
  const router = useRouter();
  const isSubject = draft.materialKind === "SUBJECT";
  const statusLocked = isSubject || isNew;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const payload = isNew ? { ...draft, publicationStatus: "DRAFT" as const, status: "inactive" as const } : draft;
    const parsed = materialSchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the material fields."); return; }
    setBusy(true); setError("");
    try {
      const result = await saveMaterial(parsed.data);
      if (!result.ok) { setError(result.error.message); return; }
      router.refresh();
      onSaved();
    } catch { setError("Unable to save material. Please retry."); }
    finally { setBusy(false); }
  }

  return <ModalPanel labelledBy={titleId} busy={busy} onCancel={onClose}>
    <form onSubmit={submit} className="bg-white p-5 text-slate-800 sm:p-7 dark:bg-slate-900 dark:text-slate-100">
      <h2 id={titleId} className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{isNew ? "Add" : "Edit"} {isSubject ? "subject" : "exam track"}</h2>
      <p id={readinessId} className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{isSubject ? foundationNotice : isNew ? "New exam tracks are saved as Draft and Inactive. Publication and availability can be reviewed after the first save." : "Publication and availability are separate settings. Archived or inactive tracks are not offered as active catalog materials."}</p>
      <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Material details</legend>
        <label className="grid min-w-0 gap-2 text-sm font-medium sm:col-span-2">Name<input autoFocus required dir="auto" maxLength={200} className={fieldClass} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium sm:col-span-2">Description<textarea required dir="auto" maxLength={3000} rows={4} className={fieldClass} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Specialty<Select required={isSubject} className={fieldClass} value={draft.specialtyId ?? ""} onChange={event => setDraft({ ...draft, specialtyId: event.target.value || null })}>
          <option value="">{isSubject ? "Choose a specialty" : "Unassigned"}</option>
          {specialties.map(specialty => <option key={specialty.id} value={specialty.id} dir="auto">{specialty.name}</option>)}
        </Select></label>
        {!isSubject ? <label className="grid min-w-0 gap-2 text-sm font-medium">Exam category<Select required className={fieldClass} value={draft.examCategory ?? "OTHER"} onChange={event => setDraft({ ...draft, examCategory: event.target.value as NonNullable<MaterialInput["examCategory"]> })}>
          {examCategories.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}
        </Select></label> : null}
        <label className="grid min-w-0 gap-2 text-sm font-medium">Icon<Select className={fieldClass} value={draft.icon} onChange={event => setDraft({ ...draft, icon: event.target.value as MaterialInput["icon"] })}>
          {materialIcons.map(icon => <option key={icon} value={icon}>{iconLabels[icon]}</option>)}
        </Select></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Language<Select className={fieldClass} value={draft.language} onChange={event => setDraft({ ...draft, language: event.target.value as MaterialInput["language"] })}>
          {materialLanguages.map(language => <option key={language} value={language}>{languageLabels[language]}</option>)}
        </Select></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Display order<input required type="number" min={0} max={10000} step={1} className={fieldClass} value={Number.isFinite(draft.displayOrder) ? draft.displayOrder : ""} onChange={event => setDraft({ ...draft, displayOrder: event.target.valueAsNumber })} /></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Publication status<Select disabled={statusLocked} aria-describedby={readinessId} className={fieldClass} value={draft.publicationStatus} onChange={event => setDraft({ ...draft, publicationStatus: event.target.value as MaterialInput["publicationStatus"] })}>
          <option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
        </Select></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Availability<Select disabled={statusLocked} aria-describedby={readinessId} className={fieldClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as MaterialInput["status"] })}>
          <option value="inactive">Inactive</option><option value="active">Active</option>
        </Select></label>
      </fieldset>
      {isSubject && specialties.length === 0 ? <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">Create a specialty in Specialties before saving a subject.</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={busy || (isSubject && specialties.length === 0)} className="min-h-11 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50">{busy ? "Saving…" : "Save material"}</button>
        <button type="button" disabled={busy} onClick={onClose} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  </ModalPanel>;
}
