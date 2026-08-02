"use client";

import { AlertCircle, CheckCircle2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { DEFAULT_PORTFOLIO_CONTENT } from "@/data/portfolio-content.default";
import { usePortfolioContent } from "@/features/portfolio-content/portfolio-content-provider";
import { cn } from "@/lib/cn";
import type {
  PortfolioContent,
  PortfolioPageContent,
  PortfolioSectionKey,
} from "@/types/portfolio-content";

const sectionLabels: Record<PortfolioSectionKey, string> = {
  about: "About page",
  services: "Services page",
  platform: "Platform page",
  contact: "Contact page",
};

type StandardSectionKey = Exclude<PortfolioSectionKey, "contact">;
type StandardFieldKey = Exclude<keyof PortfolioPageContent, "items">;
type Feedback = { readonly type: "success" | "error"; readonly message: string };

export function PortfolioEditor() {
  const store = usePortfolioContent();

  if (!store.isReady) {
    return <div className="h-80 animate-pulse rounded-2xl border bg-white" aria-label="Loading portfolio editor" />;
  }

  return <ReadyPortfolioEditor initialContent={store.content} />;
}

function ReadyPortfolioEditor({ initialContent }: { readonly initialContent: PortfolioContent }) {
  const { savePortfolioContent, resetPortfolioContent } = usePortfolioContent();
  const [draft, setDraft] = useState<PortfolioContent>(() => structuredClone(initialContent));
  const [activeSection, setActiveSection] = useState<PortfolioSectionKey>("about");
  const [isSaving, setIsSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialContent),
    [draft, initialContent],
  );

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
    }

    function warnBeforeNavigation(event: MouseEvent) {
      if (!isDirty || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || !(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      if (!window.confirm("You have unsaved portfolio changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeNavigation, true);
    };
  }, [isDirty]);

  function updateStandardField(section: StandardSectionKey, field: StandardFieldKey, value: string) {
    setDraft((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }));
    clearFieldError(`${section}.${field}`);
    setFeedback(null);
  }

  function updateContactField(field: keyof PortfolioContent["contact"], value: string) {
    setDraft((current) => ({
      ...current,
      contact: { ...current.contact, [field]: value },
    }));
    clearFieldError(`contact.${field}`);
    setFeedback(null);
  }

  function updateItem(section: StandardSectionKey, index: number, field: "title" | "description", value: string) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        items: current[section].items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
    clearFieldError(`${section}.items.${index}.${field}`);
    setFeedback(null);
  }

  function addItem(section: StandardSectionKey) {
    const id = `${section}-${crypto.randomUUID()}`;
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        items: [...current[section].items, { id, title: "", description: "" }],
      },
    }));
    setFeedback(null);
  }

  function removeItem(section: StandardSectionKey, index: number) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        items: current[section].items.filter((_, itemIndex) => itemIndex !== index),
      },
    }));
    setFeedback(null);
  }

  function clearFieldError(path: string) {
    setErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  async function handleSave() {
    const validationErrors = validatePortfolioContent(draft);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstPath = Object.keys(validationErrors)[0];
      const firstSection = firstPath?.split(".")[0];
      if (isPortfolioSection(firstSection)) setActiveSection(firstSection);
      setFeedback({ type: "error", message: "Please complete all required fields before saving." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      await savePortfolioContent(draft);
      setFeedback({ type: "success", message: "Portfolio content updated successfully." });
    } catch {
      setFeedback({ type: "error", message: "Portfolio content could not be saved. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    resetPortfolioContent();
    setDraft(structuredClone(DEFAULT_PORTFOLIO_CONTENT));
    setResetOpen(false);
    setErrors({});
    setFeedback({ type: "success", message: "Default portfolio content restored." });
  }

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Portfolio content</h1>
            {isDirty && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Unsaved changes</span>}
          </div>
          <p className="mt-2 text-sm text-slate-500">Manage the content displayed across every public portfolio page.</p>
        </div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <button type="button" onClick={() => setResetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RotateCcw className="size-4" />Reset to defaults
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || !isDirty} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="size-4" />{isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {feedback && (
        <div role={feedback.type === "error" ? "alert" : "status"} className={cn("mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium", feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {feedback.type === "success" ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Portfolio content sections" className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 lg:block lg:h-fit lg:space-y-1">
          {(Object.keys(sectionLabels) as PortfolioSectionKey[]).map((section) => (
            <button key={section} type="button" onClick={() => setActiveSection(section)} aria-current={activeSection === section ? "page" : undefined} className={cn("shrink-0 rounded-xl px-4 py-3 text-left text-sm font-medium transition lg:w-full", activeSection === section ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50")}>
              {sectionLabels[section]}
            </button>
          ))}
        </nav>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 border-b pb-5">
            <h2 className="text-lg font-semibold text-slate-950">{sectionLabels[activeSection]} content</h2>
            <p className="mt-1 text-sm text-slate-500">All fields marked required are shown on the public page.</p>
          </div>
          {activeSection === "contact" ? (
            <ContactFields content={draft.contact} errors={errors} onChange={updateContactField} />
          ) : (
            <StandardPageFields section={activeSection} content={draft[activeSection]} errors={errors} onFieldChange={updateStandardField} onItemChange={updateItem} onAddItem={addItem} onRemoveItem={removeItem} />
          )}
        </section>
      </div>

      {resetOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetOpen(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
            <h2 id="reset-title" className="text-lg font-semibold text-slate-950">Reset portfolio content?</h2>
            <p id="reset-description" className="mt-2 text-sm leading-6 text-slate-500">This replaces all saved portfolio edits with the original default content. This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" autoFocus onClick={() => setResetOpen(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={handleReset} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800">Reset content</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StandardPageFieldsProps {
  readonly section: StandardSectionKey;
  readonly content: PortfolioPageContent;
  readonly errors: Record<string, string>;
  readonly onFieldChange: (section: StandardSectionKey, field: StandardFieldKey, value: string) => void;
  readonly onItemChange: (section: StandardSectionKey, index: number, field: "title" | "description", value: string) => void;
  readonly onAddItem: (section: StandardSectionKey) => void;
  readonly onRemoveItem: (section: StandardSectionKey, index: number) => void;
}

function StandardPageFields({ section, content, errors, onFieldChange, onItemChange, onAddItem, onRemoveItem }: StandardPageFieldsProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Subtitle" value={content.subtitle} error={errors[`${section}.subtitle`]} onChange={(value) => onFieldChange(section, "subtitle", value)} />
        <FormField label="Page title" value={content.title} error={errors[`${section}.title`]} onChange={(value) => onFieldChange(section, "title", value)} />
      </div>
      <FormField label="Main description" value={content.description} error={errors[`${section}.description`]} multiline onChange={(value) => onFieldChange(section, "description", value)} />
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Section heading" value={content.sectionHeading} error={errors[`${section}.sectionHeading`]} onChange={(value) => onFieldChange(section, "sectionHeading", value)} />
        <FormField label="Button label" value={content.buttonLabel} error={errors[`${section}.buttonLabel`]} onChange={(value) => onFieldChange(section, "buttonLabel", value)} />
      </div>
      <div className="border-t pt-6">
        <div className="flex items-center justify-between gap-4">
          <div><h3 className="font-semibold text-slate-950">Content items</h3><p className="mt-1 text-xs text-slate-500">Add, edit, or remove repeatable page highlights.</p></div>
          <button type="button" onClick={() => onAddItem(section)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Plus className="size-4" />Add item</button>
        </div>
        {errors[`${section}.items`] && <p className="mt-3 text-sm text-rose-700">{errors[`${section}.items`]}</p>}
        <div className="mt-5 grid gap-4">
          {content.items.map((item, index) => (
            <div key={item.id} className="rounded-xl border bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Item {index + 1}</p><button type="button" onClick={() => onRemoveItem(section, index)} aria-label={`Remove item ${index + 1}`} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="size-4" /></button></div>
              <div className="grid gap-4">
                <FormField label="Item title" value={item.title} error={errors[`${section}.items.${index}.title`]} onChange={(value) => onItemChange(section, index, "title", value)} />
                <FormField label="Item description" value={item.description} error={errors[`${section}.items.${index}.description`]} multiline onChange={(value) => onItemChange(section, index, "description", value)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactFields({ content, errors, onChange }: { readonly content: PortfolioContent["contact"]; readonly errors: Record<string, string>; readonly onChange: (field: keyof PortfolioContent["contact"], value: string) => void }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Subtitle" value={content.subtitle} error={errors["contact.subtitle"]} onChange={(value) => onChange("subtitle", value)} />
        <FormField label="Page title" value={content.title} error={errors["contact.title"]} onChange={(value) => onChange("title", value)} />
      </div>
      <FormField label="Main description" value={content.description} error={errors["contact.description"]} multiline onChange={(value) => onChange("description", value)} />
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Section heading" value={content.sectionHeading} error={errors["contact.sectionHeading"]} onChange={(value) => onChange("sectionHeading", value)} />
        <FormField label="Button label" value={content.buttonLabel} error={errors["contact.buttonLabel"]} onChange={(value) => onChange("buttonLabel", value)} />
        <FormField label="Email address" type="email" value={content.email} error={errors["contact.email"]} onChange={(value) => onChange("email", value)} />
        <FormField label="Phone number" type="tel" value={content.phone} error={errors["contact.phone"]} onChange={(value) => onChange("phone", value)} />
      </div>
      <FormField label="Address" value={content.address} error={errors["contact.address"]} onChange={(value) => onChange("address", value)} />
    </div>
  );
}

function FormField({ label, value, error, multiline = false, type = "text", onChange }: { readonly label: string; readonly value: string; readonly error?: string | undefined; readonly multiline?: boolean; readonly type?: "text" | "email" | "tel"; readonly onChange: (value: string) => void }) {
  const generatedId = useId();
  const id = `portfolio-${generatedId.replaceAll(":", "")}`;
  const classes = cn("w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-800 transition focus:bg-white", error && "border-rose-400");
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label} <span className="text-rose-600" aria-hidden="true">*</span></span>
      {multiline ? <textarea id={id} rows={4} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} className={classes} /> : <input id={id} type={type} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} className={classes} />}
      {error && <span id={`${id}-error`} className="text-xs font-medium text-rose-700">{error}</span>}
    </label>
  );
}

function validatePortfolioContent(content: PortfolioContent): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = (path: string, value: string) => { if (!value.trim()) errors[path] = "This field is required."; };

  for (const section of ["about", "services", "platform"] as const) {
    const page = content[section];
    required(`${section}.subtitle`, page.subtitle);
    required(`${section}.title`, page.title);
    required(`${section}.description`, page.description);
    required(`${section}.sectionHeading`, page.sectionHeading);
    required(`${section}.buttonLabel`, page.buttonLabel);
    if (page.items.length === 0) errors[`${section}.items`] = "Add at least one content item.";
    page.items.forEach((item, index) => {
      required(`${section}.items.${index}.title`, item.title);
      required(`${section}.items.${index}.description`, item.description);
    });
  }

  const contact = content.contact;
  for (const field of ["subtitle", "title", "description", "sectionHeading", "buttonLabel", "email", "phone", "address"] as const) {
    required(`contact.${field}`, contact[field]);
  }
  if (contact.email.trim() && !/^\S+@\S+\.\S+$/.test(contact.email)) errors["contact.email"] = "Enter a valid email address.";
  return errors;
}

function isPortfolioSection(value: string | undefined): value is PortfolioSectionKey {
  return value === "about" || value === "services" || value === "platform" || value === "contact";
}
