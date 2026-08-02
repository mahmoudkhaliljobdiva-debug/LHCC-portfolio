import type { AdminQuestion } from "@/types/question-bank";

export const DEFAULT_ADMIN_QUESTIONS = [
  {
    id: "question-anatomy-heart",
    bankId: "anatomy",
    text: "Which organ pumps blood through the human body?",
    type: "QCU",
    status: "active",
    answers: [
      { id: "answer-heart-liver", text: "Liver", isCorrect: false },
      { id: "answer-heart-heart", text: "Heart", isCorrect: true },
      { id: "answer-heart-kidney", text: "Kidney", isCorrect: false },
      { id: "answer-heart-lung", text: "Lung", isCorrect: false },
    ],
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-04-02T10:00:00.000Z",
  },
  {
    id: "question-anatomy-bones",
    bankId: "anatomy",
    text: "How many bones are typically present in the adult human body?",
    type: "QCU",
    status: "active",
    answers: [
      { id: "answer-bones-186", text: "186", isCorrect: false },
      { id: "answer-bones-206", text: "206", isCorrect: true },
      { id: "answer-bones-226", text: "226", isCorrect: false },
      { id: "answer-bones-246", text: "246", isCorrect: false },
    ],
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-06-12T09:30:00.000Z",
  },
  {
    id: "question-physiology-insulin",
    bankId: "physiology",
    text: "Which organ produces insulin?",
    type: "QCU",
    status: "active",
    answers: [
      { id: "answer-insulin-liver", text: "Liver", isCorrect: false },
      { id: "answer-insulin-pancreas", text: "Pancreas", isCorrect: true },
      { id: "answer-insulin-spleen", text: "Spleen", isCorrect: false },
    ],
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  },
] as const satisfies readonly AdminQuestion[];
