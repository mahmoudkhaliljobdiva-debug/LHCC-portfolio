import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningCatalog } from "@/lib/learning/server";
import { SpecialtyIcon } from "@/components/ui/specialty-icon";
import { SpecialtyMaterials } from "@/features/learning/specialty-materials";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const {slug}=await params;const specialty=(await getLearningCatalog()).find(s=>s.slug===slug);if(!specialty)notFound();
  return <section className="mx-auto max-w-7xl space-y-8 px-5 py-12 md:px-8">
    <header>
      <Link href="/services" className="inline-flex min-h-11 items-center font-semibold text-teal-700">Back to services</Link>
      <span className="mt-6 grid size-20 place-items-center rounded-2xl bg-teal-50 text-teal-700"><SpecialtyIcon icon={specialty.icon} className="size-14" /></span>
      <h1 dir="auto" className="mt-4 break-words text-3xl font-semibold text-slate-950">{specialty.name}</h1>
      {specialty.description && <p dir="auto" className="mt-3 max-w-3xl break-words text-slate-600">{specialty.description}</p>}
    </header>
    <SpecialtyMaterials materials={specialty.materials} />
  </section>;
}
