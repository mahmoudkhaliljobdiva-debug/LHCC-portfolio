import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortfolioPage } from "@/features/portfolio-content/portfolio-page";
import { getPortfolioContent } from "@/lib/portfolio/server";
import { PORTFOLIO_SECTIONS, type PortfolioSectionKey } from "@/types/portfolio-content";
import { getLearningCatalog } from "@/lib/learning/server";
import { SpecialtyCatalog } from "@/features/learning/specialty-catalog";

function isPortfolioSection(value: string): value is PortfolioSectionKey {
  return PORTFOLIO_SECTIONS.some((section) => section === value);
}

export function generateStaticParams() {
  return PORTFOLIO_SECTIONS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = isPortfolioSection(slug) ? await getPortfolioContent() : null;
  return {
    title: content && isPortfolioSection(slug) ? content[slug].title : "Page",
    ...(isPortfolioSection(slug) ? { alternates: { canonical: `/${slug}` } } : {}),
  };
}

export default async function MarketingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isPortfolioSection(slug)) notFound();
  const [content,catalog] = await Promise.all([getPortfolioContent(),slug==="services"?getLearningCatalog():Promise.resolve([])]);
  if (!content) return <section className="mx-auto max-w-7xl px-5 py-24"><h1 className="text-3xl font-semibold text-slate-950">Content coming soon</h1><p className="mt-4 text-slate-600">This page has not been published yet. Please check back later.</p></section>;
  return <><PortfolioPage section={slug} content={content}/>{slug==="services" && <section className="mx-auto max-w-7xl px-5 py-12 md:px-8"><h2 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{content.services.catalogHeading}</h2><p className="mt-3 max-w-3xl text-slate-600">{content.services.catalogDescription}</p><div className="mt-7"><SpecialtyCatalog catalog={catalog} publicView/></div></section>}</>;
}
