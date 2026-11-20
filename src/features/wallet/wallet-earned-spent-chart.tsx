"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { WalletChartPoint } from "@/utils/wallet-analytics";

export function WalletEarnedSpentChart({ data }: { readonly data: readonly WalletChartPoint[] }) { return <div className="h-80 w-full" aria-label="Money earned versus money spent chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={[...data]} margin={{ left: -14, right: 14, top: 10 }}><CartesianGrid vertical={false} stroke="#d9e0e2" /><XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(value: number) => `$${value}`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /><Line type="monotone" name="Money Earned" dataKey="earned" stroke="#15803d" strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" name="Money Spent" dataKey="spent" stroke="#b91c1c" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>; }
function formatCurrency(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
