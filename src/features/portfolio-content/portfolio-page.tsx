"use client";

import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { usePortfolioContent } from "@/features/portfolio-content/portfolio-content-provider";
import type { PortfolioSectionKey } from "@/types/portfolio-content";

export function PortfolioPage({ section }: { readonly section: PortfolioSectionKey }) {
  const { content } = usePortfolioContent();

  if (section === "contact") {
    const page = content.contact;
    const details = [
      { id: "email", icon: Mail, value: page.email },
      { id: "phone", icon: Phone, value: page.phone },
      { id: "address", icon: MapPin, value: page.address },
    ] as const;

    return (
      <PortfolioPageLayout subtitle={page.subtitle} title={page.title} description={page.description}>
        <PortfolioPanel heading={page.sectionHeading}>
          {details.map(({ id, icon: Icon, value }) => (
            <div key={id} className="flex items-center gap-4 rounded-xl border bg-white p-4 text-sm font-medium text-slate-700">
              <Icon className="size-5 shrink-0 text-teal-700" />
              <span className="break-all">{value}</span>
            </div>
          ))}
          <a href={`mailto:${page.email}`} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
            {page.buttonLabel}<ArrowRight className="size-4" />
          </a>
        </PortfolioPanel>
      </PortfolioPageLayout>
    );
  }

  const page = content[section];
  return (
    <PortfolioPageLayout subtitle={page.subtitle} title={page.title} description={page.description}>
      <PortfolioPanel heading={page.sectionHeading}>
        {page.items.map((item) => (
          <article key={item.id} className="flex gap-4 rounded-xl border bg-white p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
            </div>
          </article>
        ))}
        <Link href="/student" className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
          {page.buttonLabel}<ArrowRight className="size-4" />
        </Link>
      </PortfolioPanel>
    </PortfolioPageLayout>
  );
}

function PortfolioPageLayout({ subtitle, title, description, children }: { readonly subtitle: string; readonly title: string; readonly description: string; readonly children: React.ReactNode }) {
  return (
    <section className="bg-white">
      <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">{subtitle}</p>
          <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{title}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function PortfolioPanel({ heading, children }: { readonly heading: string; readonly children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-slate-50 p-5 sm:p-8 lg:p-10">
      <p className="text-sm font-semibold text-slate-950">{heading}</p>
      <div className="mt-6 grid gap-4">{children}</div>
    </div>
  );
}

