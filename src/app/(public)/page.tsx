import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

const capabilities = [
  {
    icon: BookOpenCheck,
    title: "Focused question banks",
    text: "Build clinical reasoning through carefully organized practice across six essential medical disciplines.",
  },
  {
    icon: BarChart3,
    title: "Clear performance insight",
    text: "Turn every answer into useful feedback with score trends, topic breakdowns, and actionable progress signals.",
  },
  {
    icon: GraduationCap,
    title: "Teaching that scales",
    text: "Create assessments, organize cohorts, and identify where learners need support from one calm workspace.",
  },
] as const;

const audiences = [
  { icon: GraduationCap, label: "Students", text: "Practice with purpose and know what to study next." },
  { icon: Users, label: "Educators", text: "Guide every cohort with shared, measurable insight." },
  { icon: ShieldCheck, label: "Institutions", text: "Coordinate learning through a reliable central platform." },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_70%_20%,#d9f3f0_0,transparent_42%)]" />
        <div className="relative mx-auto grid min-h-[690px] max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.04fr_.96fr] lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
              <Sparkles className="size-3.5" />
              Healthcare learning, connected
            </div>
            <h1 className="max-w-3xl text-5xl leading-[1.04] font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">
              Learn medicine with clarity and confidence.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
              A focused learning platform that brings question banks, assessments,
              progress analytics, and educator tools into one thoughtfully designed experience.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/student"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
              >
                Open student demo <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/platform"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Explore the platform
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
              {["Six medical Qbanks", "Role-based portals", "Progress analytics"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-teal-600" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-5 rounded-[36px] bg-teal-100/50" />
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-30px_rgba(15,52,75,.35)] sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">Today&apos;s focus</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Clinical mastery</h2>
                </div>
                <span className="grid size-11 place-items-center rounded-full bg-teal-50 text-teal-700">
                  <HeartPulse />
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#0d3852] p-5 text-white">
                  <p className="text-sm text-sky-100">Weekly accuracy</p>
                  <p className="mt-2 text-4xl font-semibold">84%</p>
                  <p className="mt-6 text-xs text-sky-100">↑ 6% from last week</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm text-slate-500">Questions completed</p>
                  <p className="mt-2 text-4xl font-semibold text-slate-950">1,441</p>
                  <div className="mt-7 h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-[72%] rounded-full bg-teal-600" />
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Continue learning</p>
                    <p className="mt-1 text-sm text-slate-500">Cardiovascular pathology · 18 questions</p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-full bg-teal-600 text-white">
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-center text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            One connected learning system
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Everything needed to move from knowledge to clinical confidence.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border bg-white p-7 shadow-sm">
                <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-800">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">Built for every role</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                A better view for everyone.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Each portal is tailored to its users while sharing the same dependable
              content, language, and design system.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-slate-200 md:grid-cols-3">
            {audiences.map(({ icon: Icon, label, text }) => (
              <article key={label} className="bg-white p-8">
                <Icon className="size-6 text-teal-700" />
                <h3 className="mt-8 text-xl font-semibold text-slate-950">{label}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#e8f4f5] px-5 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-slate-950">
            See the whole learning journey.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            Explore the interactive demo from the perspective of a student, educator, or administrator.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {[
              { href: "/student" as const, label: "Student portal" },
              { href: "/teacher" as const, label: "Teacher portal" },
              { href: "/admin" as const, label: "Admin portal" },
            ].map((portal) => (
              <Link key={portal.href} href={portal.href} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
                {portal.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
