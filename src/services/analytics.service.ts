import {
  PERFORMANCE_METRICS,
  SCORE_DISTRIBUTION,
  SCORE_TREND,
} from "@/data/analytics.mock";

export function getAnalyticsSnapshot() {
  return {
    metrics: PERFORMANCE_METRICS,
    scoreDistribution: SCORE_DISTRIBUTION,
    scoreTrend: SCORE_TREND,
  };
}

