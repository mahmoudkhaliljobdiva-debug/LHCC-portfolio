import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const pages = {
  about: {
    eyebrow: "About MedLumen",
    title: "Better learning creates better care.",
    description:
      "We are building a calm, rigorous digital environment where healthcare learners and educators can focus on meaningful progress.",
    points: ["Clinically focused learning", "Clear and ethical analytics", "Accessible by design"],
  },
  services: {
    eyebrow: "Our services",
    title: "Tools for every stage of medical learning.",
    description:
      "Structured practice, educator workflows, cohort insight, and institutional oversight—designed as one connected experience.",
    points: ["Student preparation", "Educator assessment tools", "Institutional reporting"],
  },
  platform: {
    eyebrow: "The platform",
    title: "One workspace. Every learning signal.",
    description:
      "Move from focused question practice to assessment, feedback, credit rewards, and long-term performance trends without losing context.",
    points: ["Reusable question banks", "Mock exams and assignments", "Progress and wallet analytics"],
  },
  contact: {
    eyebrow: "Contact",
    title: "Let’s talk about better healthcare learning.",
    description:
      "Whether you represent a medical school, teaching team, or learning program, we would be glad to hear what you are building.",
    points: ["hello@medlumen.example", "+961 1 555 014", "Beirut, Lebanon"],
  },
} as const;

type PageSlug = keyof typeof pages;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = pages[slug as PageSlug];
  return { title: page?.title ?? "Page" };
}

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pages[slug as PageSlug];
  if (!page) notFound();
  const isContact = slug === "contact";
  const contactIcons = [Mail, Phone, MapPin];

  return (
    <section className="bg-white">
      <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-16 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">{page.eyebrow}</p>
          <h1 className="mt-5 max-w-2xl text-5xl leading-tight font-semibold tracking-[-0.04em] text-slate-950">
            {page.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">{page.description}</p>
          {!isContact && (
            <Link href="/student" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">
              Explore demo <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
        <div className="rounded-3xl border bg-slate-50 p-7 sm:p-10">
          <p className="text-sm font-semibold text-slate-950">
            {isContact ? "Get in touch" : "Designed around what matters"}
          </p>
          <div className="mt-7 grid gap-4">
            {page.points.map((point, index) => {
              const Icon = isContact ? contactIcons[index] : CheckCircle2;
              return (
                <div key={point} className="flex items-center gap-4 rounded-xl border bg-white p-4 text-sm font-medium text-slate-700">
                  {Icon && <Icon className="size-5 text-teal-700" />}
                  {point}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

