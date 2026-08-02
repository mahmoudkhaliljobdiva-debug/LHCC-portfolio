import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEFAULT_PORTFOLIO_CONTENT } from "@/data/portfolio-content.default";
import { PortfolioPage } from "@/features/portfolio-content/portfolio-page";
import { PORTFOLIO_SECTIONS, type PortfolioSectionKey } from "@/types/portfolio-content";

function isPortfolioSection(value: string): value is PortfolioSectionKey {
  return PORTFOLIO_SECTIONS.some((section) => section === value);
}

export function generateStaticParams() {
  return PORTFOLIO_SECTIONS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: isPortfolioSection(slug) ? DEFAULT_PORTFOLIO_CONTENT[slug].title : "Page",
  };
}

export default async function MarketingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isPortfolioSection(slug)) notFound();
  return <PortfolioPage section={slug} />;
}
