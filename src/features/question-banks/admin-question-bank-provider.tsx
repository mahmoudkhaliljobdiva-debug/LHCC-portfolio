"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { loadQuestionBankData, persistQuestionBankData, QUESTION_BANK_STORAGE_KEY } from "@/services/admin-question-bank.storage";
import type { AdminQuestion, AdminQuestionBank, QuestionBankInput, QuestionBankStoreData, QuestionInput } from "@/types/question-bank";

interface AdminQuestionBankContextValue {
  readonly banks: readonly AdminQuestionBank[];
  readonly questions: readonly AdminQuestion[];
  readonly isReady: boolean;
  readonly addQuestionBank: (input: QuestionBankInput) => AdminQuestionBank;
  readonly updateQuestionBank: (id: string, input: QuestionBankInput) => void;
  readonly deleteQuestionBank: (id: string) => void;
  readonly getQuestionBankById: (id: string) => AdminQuestionBank | undefined;
  readonly addQuestion: (bankId: string, input: QuestionInput) => AdminQuestion;
  readonly updateQuestion: (id: string, input: QuestionInput) => void;
  readonly deleteQuestion: (id: string) => void;
  readonly getQuestionsByBankId: (bankId: string) => readonly AdminQuestion[];
  readonly getQuestionById: (id: string) => AdminQuestion | undefined;
}

const AdminQuestionBankContext = createContext<AdminQuestionBankContextValue | null>(null);

export function AdminQuestionBankProvider({ children }: { readonly children: React.ReactNode }) {
  const [data, setData] = useState<QuestionBankStoreData>(() => ({ banks: [], questions: [] }));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setData(loadQuestionBankData()); setIsReady(true); }, 0);
    function sync(event: StorageEvent) { if (event.key === null || event.key === QUESTION_BANK_STORAGE_KEY) setData(loadQuestionBankData()); }
    window.addEventListener("storage", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", sync); };
  }, []);

  const commit = useCallback((updater: (current: QuestionBankStoreData) => QuestionBankStoreData) => {
    setData((current) => { const next = updater(current); persistQuestionBankData(next); return next; });
  }, []);

  const addQuestionBank = useCallback((input: QuestionBankInput) => {
    const now = new Date().toISOString();
    const bank: AdminQuestionBank = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
    commit((current) => ({ ...current, banks: [...current.banks, bank] }));
    return bank;
  }, [commit]);

  const updateQuestionBank = useCallback((id: string, input: QuestionBankInput) => {
    commit((current) => ({ ...current, banks: current.banks.map((bank) => bank.id === id ? { ...bank, ...input, updatedAt: new Date().toISOString() } : bank) }));
  }, [commit]);

  const deleteQuestionBank = useCallback((id: string) => {
    commit((current) => ({ banks: current.banks.filter((bank) => bank.id !== id), questions: current.questions.filter((question) => question.bankId !== id) }));
  }, [commit]);

  const addQuestion = useCallback((bankId: string, input: QuestionInput) => {
    const now = new Date().toISOString();
    const question: AdminQuestion = { id: crypto.randomUUID(), bankId, ...input, type: "QCU", createdAt: now, updatedAt: now };
    commit((current) => ({ ...current, questions: [...current.questions, question] }));
    return question;
  }, [commit]);

  const updateQuestion = useCallback((id: string, input: QuestionInput) => {
    commit((current) => ({ ...current, questions: current.questions.map((question) => question.id === id ? { ...question, ...input, updatedAt: new Date().toISOString() } : question) }));
  }, [commit]);

  const deleteQuestion = useCallback((id: string) => {
    commit((current) => ({ ...current, questions: current.questions.filter((question) => question.id !== id) }));
  }, [commit]);

  const value = useMemo<AdminQuestionBankContextValue>(() => ({
    banks: data.banks,
    questions: data.questions,
    isReady,
    addQuestionBank,
    updateQuestionBank,
    deleteQuestionBank,
    getQuestionBankById: (id) => data.banks.find((bank) => bank.id === id),
    addQuestion,
    updateQuestion,
    deleteQuestion,
    getQuestionsByBankId: (bankId) => data.questions.filter((question) => question.bankId === bankId),
    getQuestionById: (id) => data.questions.find((question) => question.id === id),
  }), [addQuestion, addQuestionBank, data, deleteQuestion, deleteQuestionBank, isReady, updateQuestion, updateQuestionBank]);

  return <AdminQuestionBankContext.Provider value={value}>{children}</AdminQuestionBankContext.Provider>;
}

export function useAdminQuestionBanks(): AdminQuestionBankContextValue {
  const context = useContext(AdminQuestionBankContext);
  if (!context) throw new Error("useAdminQuestionBanks must be used within AdminQuestionBankProvider");
  return context;
}
