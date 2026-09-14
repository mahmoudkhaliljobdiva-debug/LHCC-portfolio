export type QuestionBankStatus = "active" | "inactive";

export interface AdminQuestionBank {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: QuestionBankStatus;
  readonly displayOrder?: number;
  readonly imageUrl?: string | null;
  readonly price: number;
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
  readonly imageUrl?: string;
  readonly price: number;
};

export type QuestionInput = Pick<AdminQuestion, "text" | "status" | "answers">;
