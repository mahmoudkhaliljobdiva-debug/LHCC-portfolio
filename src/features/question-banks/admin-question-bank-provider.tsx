"use client";
import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { manageBankContent } from "@/actions/bank-content";
import type { AdminQuestion, AdminQuestionBank, QuestionBankInput, QuestionBankStoreData, QuestionInput } from "@/types/question-bank";

interface AdminQuestionBankContextValue {
  readonly banks: readonly AdminQuestionBank[];
  readonly questions: readonly AdminQuestion[];
  readonly isReady: boolean;
  readonly addQuestionBank: (input: QuestionBankInput) => Promise<void>;
  readonly updateQuestionBank: (id: string, input: QuestionBankInput) => Promise<void>;
  readonly deleteQuestionBank: (id: string) => Promise<void>;
  readonly getQuestionBankById: (id: string) => AdminQuestionBank | undefined;
  readonly addQuestion: (bankId: string, input: QuestionInput) => Promise<void>;
  readonly updateQuestion: (id: string, input: QuestionInput) => Promise<void>;
  readonly deleteQuestion: (id: string) => Promise<void>;
  readonly getQuestionsByBankId: (bankId: string) => readonly AdminQuestion[];
  readonly getQuestionById: (id: string) => AdminQuestion | undefined;
}
const AdminQuestionBankContext = createContext<AdminQuestionBankContextValue | null>(null);

export function AdminQuestionBankProvider({ children, data }: { readonly children: React.ReactNode; readonly data: QuestionBankStoreData }) {
  const router = useRouter();
  async function mutate(operation: Parameters<typeof manageBankContent>[0], id: string, input: unknown = {}) {
    const result = await manageBankContent(operation, id, input);
    if (!result.ok) throw new Error(result.error.message);
    router.refresh();
  }
  const value: AdminQuestionBankContextValue = {
    banks: data.banks, questions: data.questions, isReady: true,
    addQuestionBank: (input) => mutate("save_bank", crypto.randomUUID(), input),
    updateQuestionBank: (id, input) => mutate("save_bank", id, input),
    deleteQuestionBank: (id) => mutate("delete_bank", id),
    addQuestion: (bankId, input) => mutate("save_question", crypto.randomUUID(), { ...input, bankId }),
    updateQuestion: (id, input) => mutate("save_question", id, { ...input, bankId: data.questions.find((q) => q.id === id)?.bankId }),
    deleteQuestion: (id) => mutate("delete_question", id),
    getQuestionBankById: (id) => data.banks.find((b) => b.id === id),
    getQuestionById: (id) => data.questions.find((q) => q.id === id),
    getQuestionsByBankId: (bankId) => data.questions.filter((q) => q.bankId === bankId),
  };
  return <AdminQuestionBankContext.Provider value={value}>{children}</AdminQuestionBankContext.Provider>;
}
export function useAdminQuestionBanks(): AdminQuestionBankContextValue {
  const context = useContext(AdminQuestionBankContext);
  if (!context) throw new Error("useAdminQuestionBanks must be used within AdminQuestionBankProvider");
  return context;
}
