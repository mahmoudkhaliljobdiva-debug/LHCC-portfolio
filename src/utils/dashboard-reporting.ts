import type { Database } from "@/lib/supabase/database.types";
import type { DashboardData } from "@/types/dashboard";

type ScoreAttempt = Pick<Database["public"]["Tables"]["question_attempts"]["Row"], "score_percentage" | "started_at" | "submitted_at">;

export function getScoreReporting(completed: readonly ScoreAttempt[]) {
  const groups = new Map<string, { total: number; count: number }>();
  for (const attempt of completed) {
    const period = (attempt.submitted_at ?? attempt.started_at).slice(0, 7);
    const group = groups.get(period) ?? { total: 0, count: 0 };
    group.total += Number(attempt.score_percentage);
    group.count += 1;
    groups.set(period, group);
  }
  const ranges = [[0, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 101]] as const;
  return {
    averageScore: completed.length ? Math.round(completed.reduce((sum, item) => sum + Number(item.score_percentage), 0) / completed.length) : 0,
    scoreTrend: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => ({ period, score: Math.round(group.total / group.count) })),
    scoreDistribution: ranges.map(([min, max]) => ({
      range: `${min}–${max - 1}`,
      students: completed.filter((item) => Number(item.score_percentage) >= min && Number(item.score_percentage) < max).length,
    })),
  };
}

export function getUniqueQuestionCount(answers: readonly { question_id: string }[], activeQuestions: readonly { id: string }[]) {
  const activeIds = new Set(activeQuestions.map((question) => question.id));
  return new Set(answers.filter((answer) => activeIds.has(answer.question_id)).map((answer) => answer.question_id)).size;
}

export function sortRecentActivity(activity: DashboardData["recentActivity"]) {
  return [...activity].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, 8);
}
