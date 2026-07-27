import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly icon: LucideIcon;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-800">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-xs font-medium text-teal-700">{helper}</p>
    </article>
  );
}

