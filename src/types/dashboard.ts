import type { PerformancePoint, ScoreDistributionPoint } from "@/types/analytics";
import type { StudentBankUsage } from "@/types/user-management";

export interface DashboardMetric {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly icon: "users" | "students" | "banks" | "wallet" | "score" | "answers" | "attempts" | "pending";
}

export interface DashboardBankProgress {
  readonly id: string;
  readonly name: string;
  readonly answered: number;
  readonly totalQuestions: number;
  readonly averageScore: number;
}

export interface DashboardData {
  readonly displayName: string;
  readonly metrics: readonly DashboardMetric[];
  readonly scoreTrend: readonly PerformancePoint[];
  readonly scoreDistribution: readonly ScoreDistributionPoint[];
  readonly bankProgress: readonly DashboardBankProgress[];
  readonly recentActivity: readonly { readonly id: string; readonly title: string; readonly detail: string; readonly occurredAt: string }[];
}

export interface StudentActivityData {
  readonly student: { readonly id: string; readonly fullName: string; readonly email: string } | null;
  readonly usage: readonly StudentBankUsage[];
  readonly bankNames: Readonly<Record<string, string>>;
}
