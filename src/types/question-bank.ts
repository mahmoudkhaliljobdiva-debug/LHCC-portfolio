export type QuestionBankId =
  | "anatomy"
  | "physiology"
  | "pharmacology"
  | "pathology"
  | "microbiology"
  | "clinical-medicine";

export interface QuestionBank {
  readonly id: QuestionBankId;
  readonly title: string;
  readonly description: string;
  readonly questionCount: number;
  readonly completedCount: number;
  readonly averageScore: number;
  readonly difficulty: "Foundation" | "Intermediate" | "Advanced";
  readonly accent: "blue" | "teal" | "cyan" | "indigo" | "sky" | "slate";
}

