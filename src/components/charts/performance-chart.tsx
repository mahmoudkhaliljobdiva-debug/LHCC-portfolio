"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PerformancePoint, ScoreDistributionPoint } from "@/types/analytics";

export function PerformanceChart({
  variant = "score",
  data,
}: {
  readonly variant?: "score" | "histogram";
  readonly data: readonly PerformancePoint[] | readonly ScoreDistributionPoint[];
}) {
  const isHistogram = variant === "histogram";
  const chartData: { [key: string]: string | number }[] = data.map((point) => ({ ...point }));
  const dataKey = isHistogram ? "students" : "score";
  const xKey = isHistogram ? "range" : "period";

  return (
    <div className="h-72 min-w-0 w-full" aria-label={`${variant} performance chart`}>
      <ResponsiveContainer width="100%" height="100%">
        {isHistogram ? (
          <BarChart data={chartData} margin={{ top: 10, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", color: "var(--color-foreground)", borderColor: "var(--color-border)", borderRadius: 12 }} labelStyle={{ color: "var(--color-foreground)" }} cursor={{ fill: "var(--color-surface-muted)" }} />
            <Bar isAnimationActive={false} dataKey={dataKey} name="Attempts" fill="#e59a88" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id={`chart-fill-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#52798a" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#52798a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", color: "var(--color-foreground)", borderColor: "var(--color-border)", borderRadius: 12 }} labelStyle={{ color: "var(--color-foreground)" }} />
            <Area isAnimationActive={false} type="monotone" dataKey={dataKey} stroke="var(--chart-line)" strokeWidth={2.5} fill={`url(#chart-fill-${variant})`} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
