import { extractExamText } from "@/lib/exams/pdf-extraction";
import type { LessonQuestion } from "@/types/lesson";

const digits = "٠١٢٣٤٥٦٧٨٩";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const optionLetters: Readonly<Record<string, string>> = {
  "ا": "A", "أ": "A", "إ": "A", "آ": "A", "ب": "B", "ج": "C", "د": "D",
  "ه": "E", "و": "F", "ز": "G", "ح": "H", "ط": "I", "ي": "J", "ی": "J",
};
const asciiDigits = (value: string) => value.replace(/[٠-٩۰-۹]/gu, digit => {
  const index = digits.indexOf(digit);
  return String(index < 0 ? persianDigits.indexOf(digit) : index);
});
const optionId = (value: string) => optionLetters[value] ?? value.toUpperCase();

/**
 * Adapt explicit Arabic/English labels to the existing conservative exam parser.
 * Clinical text is not translated, answer keys are never guessed, and flattened
 * PDF text cannot establish a reliable page number. Every result needs review.
 */
export function extractLessonText(text: string, documentId: string): { questions: LessonQuestion[]; warnings: string[] } {
  const sourceNumbers: string[] = [];
  const caseTitles = new Map<string, string>();
  let keyMode = false;
  const normalized = text.replaceAll("\r", "").split("\n").map(raw => {
    const line = raw.trim();
    if (/^(?:مفتاح\s+(?:الإجاب(?:ة|ات)|الاجاب(?:ة|ات))|(?:الإجابات|الاجابات)(?:\s+الصحيحة)?|answer\s*key|correct\s*answers|corrig[ée])\s*[:：]?$/iu.test(line)) {
      keyMode = true;
      return "Answer key";
    }
    if (keyMode) {
      return line.replace(/([0-9٠-٩۰-۹]+)\s*[.):=\-،]\s*([A-Ja-jاأإآبجدهوزحطيی])(?=$|[\s,;،؛])/gu,
        (_match: string, number: string, answer: string) => `${asciiDigits(number)}: ${optionId(answer)}`);
    }
    if (/^(?:حالة\s+سريرية|الحالة\s+السريرية)(?:\s|[:：0-9٠-٩۰-۹]|$)/u.test(line)) {
      const title = `Clinical case — ${line}`;
      caseTitles.set(title, line);
      return title;
    }
    const question = line.match(/^(?:(?:question|السؤال|سؤال)\s*)?([0-9٠-٩۰-۹]+)\s*[.)\-:،]\s+(.+)$/iu);
    if (question?.[1] && question[2]) {
      sourceNumbers.push(question[1]);
      return `${asciiDigits(question[1])}. ${question[2]}`;
    }
    const option = line.match(/^([A-Ja-jاأإآبجدهوزحطيی])\s*[.)\-:،]\s+(.+)$/u);
    if (option?.[1] && option[2]) return `${optionId(option[1])}. ${option[2]}`;
    return raw;
  }).join("\n");
  const extracted = extractExamText(normalized);
  return {
    questions: extracted.questions.map((question, index) => ({
      ...question,
      sourceNumber: sourceNumbers[index] ?? question.sourceNumber,
      caseTitle: caseTitles.get(question.caseTitle) ?? question.caseTitle,
      verified: false,
      includeInBank: false,
      explanation: "",
      documentId,
      sourcePage: null,
    })),
    warnings: [
      ...extracted.warnings,
      "Only questions already present in the document are extracted. No questions, answers or teaching explanations are generated. Page references require manual review.",
      "Text extraction does not detect yellow highlights or other visual answer markings. Review the private PDF and explicitly enter and verify its marked answer; never infer a missing key.",
    ],
  };
}
