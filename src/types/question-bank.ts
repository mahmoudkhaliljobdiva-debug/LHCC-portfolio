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

export type QuestionBankStatus = "active" | "inactive";

export interface AdminQuestionBank {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: QuestionBankStatus;
  readonly displayOrder?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuestionAnswer {
  readonly id: string;
  readonly text: string;
  readonly isCorrect: boolean;
}

export interface AdminQuestion {
  readonly id: string;
  readonly bankId: string;
  readonly text: string;
  readonly type: "QCU";
  readonly status: QuestionBankStatus;
  readonly answers: readonly QuestionAnswer[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuestionBankStoreData {
  readonly banks: readonly AdminQuestionBank[];
  readonly questions: readonly AdminQuestion[];
}

export type QuestionBankInput = Pick<AdminQuestionBank, "name" | "description" | "status"> & {
  readonly displayOrder?: number;
};

export type QuestionInput = Pick<AdminQuestion, "text" | "status" | "answers">;
