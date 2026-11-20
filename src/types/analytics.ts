export interface ScoreDistributionPoint {
  readonly range: string;
  readonly students: number;
}

export interface PerformancePoint {
  readonly period: string;
  readonly score: number;
}

export interface PerformanceMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: "percent" | "count" | "credits";
  readonly change: number;
}

