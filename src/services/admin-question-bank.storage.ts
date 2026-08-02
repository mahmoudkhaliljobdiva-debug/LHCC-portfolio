import { DEFAULT_ADMIN_QUESTION_BANKS } from "@/data/default-question-banks";
import { DEFAULT_ADMIN_QUESTIONS } from "@/data/default-questions";
import type { AdminQuestion, AdminQuestionBank, QuestionBankStoreData } from "@/types/question-bank";

export const QUESTION_BANK_STORAGE_KEY = "lhcc-admin-question-banks";

const defaultData: QuestionBankStoreData = {
  banks: DEFAULT_ADMIN_QUESTION_BANKS,
  questions: DEFAULT_ADMIN_QUESTIONS,
};

function isString(value: unknown): value is string { return typeof value === "string"; }
function isStatus(value: unknown): value is "active" | "inactive" { return value === "active" || value === "inactive"; }

function isBank(value: unknown): value is AdminQuestionBank {
  if (!value || typeof value !== "object") return false;
  const bank = value as Record<string, unknown>;
  return isString(bank.id) && isString(bank.name) && isString(bank.description) && isStatus(bank.status) &&
    (bank.displayOrder === undefined || typeof bank.displayOrder === "number") && isString(bank.createdAt) && isString(bank.updatedAt);
}

function isQuestion(value: unknown): value is AdminQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  return isString(question.id) && isString(question.bankId) && isString(question.text) && question.type === "QCU" &&
    isStatus(question.status) && isString(question.createdAt) && isString(question.updatedAt) && Array.isArray(question.answers) &&
    question.answers.length >= 2 && question.answers.every((answer) => {
      if (!answer || typeof answer !== "object") return false;
      const item = answer as Record<string, unknown>;
      return isString(item.id) && isString(item.text) && typeof item.isCorrect === "boolean";
    }) && question.answers.filter((answer) => (answer as { isCorrect: boolean }).isCorrect).length === 1;
}

function isStoreData(value: unknown): value is QuestionBankStoreData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.banks) && data.banks.every(isBank) && Array.isArray(data.questions) && data.questions.every(isQuestion);
}

export function loadQuestionBankData(): QuestionBankStoreData {
  if (typeof window === "undefined") return defaultData;
  try {
    const saved = window.localStorage.getItem(QUESTION_BANK_STORAGE_KEY);
    if (!saved) return defaultData;
    const parsed: unknown = JSON.parse(saved);
    return isStoreData(parsed) ? parsed : defaultData;
  } catch {
    return defaultData;
  }
}

export function persistQuestionBankData(data: QuestionBankStoreData): void {
  window.localStorage.setItem(QUESTION_BANK_STORAGE_KEY, JSON.stringify(data));
}
