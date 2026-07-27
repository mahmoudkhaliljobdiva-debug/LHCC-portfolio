import type {
  PerformanceMetric,
  PerformancePoint,
  ScoreDistributionPoint,
} from "@/types/analytics";

export const SCORE_DISTRIBUTION = [
  { range: "0–49", students: 4 },
  { range: "50–59", students: 8 },
  { range: "60–69", students: 17 },
  { range: "70–79", students: 31 },
  { range: "80–89", students: 44 },
  { range: "90–100", students: 26 },
] as const satisfies readonly ScoreDistributionPoint[];

export const SCORE_TREND = [
  { period: "Feb", score: 68 },
  { period: "Mar", score: 72 },
  { period: "Apr", score: 75 },
  { period: "May", score: 74 },
  { period: "Jun", score: 81 },
  { period: "Jul", score: 84 },
] as const satisfies readonly PerformancePoint[];

export const PERFORMANCE_METRICS = [
  { id: "average-score", label: "Average score", value: 84, unit: "percent", change: 6 },
  { id: "exams-completed", label: "Exams completed", value: 18, unit: "count", change: 3 },
  { id: "questions-answered", label: "Questions answered", value: 1441, unit: "count", change: 12 },
  { id: "credits-earned", label: "Credits earned", value: 780, unit: "credits", change: 8 },
] as const satisfies readonly PerformanceMetric[];

