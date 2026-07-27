import { QUESTION_BANKS } from "@/data/question-banks.mock";
import type { QuestionBank, QuestionBankId } from "@/types/question-bank";

export function getQuestionBanks(): readonly QuestionBank[] {
  return QUESTION_BANKS;
}

export function getQuestionBankById(
  id: QuestionBankId,
): QuestionBank | undefined {
  return QUESTION_BANKS.find((bank) => bank.id === id);
}

