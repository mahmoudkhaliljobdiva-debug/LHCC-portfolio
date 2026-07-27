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

import { SCORE_DISTRIBUTION, SCORE_TREND } from "@/data/analytics.mock";
import { WALLET_TREND } from "@/data/wallet.mock";

export function PerformanceChart({
  variant = "score",
}: {
  readonly variant?: "score" | "histogram" | "wallet";
}) {
  const isHistogram = variant === "histogram";
  const data: { [key: string]: string | number }[] = (
    isHistogram
      ? SCORE_DISTRIBUTION
      : variant === "wallet"
        ? WALLET_TREND
        : SCORE_TREND
  ).map((point) => ({ ...point }));
  const dataKey = isHistogram
    ? "students"
    : variant === "wallet"
      ? "balance"
      : "score";
  const xKey = isHistogram ? "range" : "period";

  return (
    <div className="h-72 w-full" aria-label={`${variant} performance chart`}>
      <ResponsiveContainer width="100%" height="100%">
        {isHistogram ? (
          <BarChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="#e5edf4" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey={dataKey} fill="#0f8b8d" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id={`chart-fill-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f8b8d" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#0f8b8d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e5edf4" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey={dataKey} stroke="#0f8b8d" strokeWidth={2.5} fill={`url(#chart-fill-${variant})`} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
