import type { ImportQuestion } from "@/types/past-exam";

/** Conservative text parser: ambiguous content remains a draft, never an inferred key. */
export function extractExamText(text: string): { questions: ImportQuestion[]; detectedYears: number[]; warnings: string[] } {
  const lines = text.replaceAll("\r", "").split("\n").map(line => line.trim()).filter(Boolean);
  const questions: ImportQuestion[] = [];
  const warnings: string[] = [];
  let current: ImportQuestion | undefined;
  let caseTitle = ""; let caseDescription = ""; let caseId: string | null = null;
  let pendingCase = false; let optionIndex = -1; let keyMode = false;
  const keys = new Map<string, string>();
  for (const line of lines) {
    if (/^(answer\s*key|correct\s*answers|corrig[eé])\s*:?$/i.test(line)) { keyMode = true; continue; }
    if (keyMode) {
      for (const match of line.matchAll(/\b(\d+)\s*[.):=\-:]\s*([A-J])\b/gi)) if (match[1] && match[2]) keys.set(match[1], match[2].toUpperCase());
      continue;
    }
    if (/^(clinical\s+case|case\s+\d+|cas\s+clinique)\b/i.test(line)) {
      caseTitle = line; caseDescription = ""; caseId = crypto.randomUUID(); pendingCase = true; current = undefined; continue;
    }
    const number = line.match(/^(?:question\s+)?(\d+)\s*[.)]\s+(.+)$/i);
    if (number?.[1] && number[2]) {
      current = { id: crypto.randomUUID(), reuseQuestionId: null, duplicateReviewed:false, sourceNumber: number[1], text: number[2], options: [], correctOptionId: null, verified: false, includeInBank: true, caseId, caseTitle, caseDescription, warnings: [] };
      questions.push(current); pendingCase = false; optionIndex = -1; continue;
    }
    if (pendingCase) { caseDescription += `${caseDescription ? "\n" : ""}${line}`; continue; }
    if (!current) continue;
    const option = line.match(/^([A-J])\s*[.)]\s+(.+)$/i);
    if (option?.[1] && option[2]) { current.options.push({ id: option[1].toUpperCase(), text: option[2] }); optionIndex = current.options.length - 1; }
    else { const previousOption = current.options[optionIndex]; if (previousOption) previousOption.text += `\n${line}`; else current.text += `\n${line}`; }
  }
  const numbers = new Set<string>();
  for (const question of questions) {
    const key = keys.get(question.sourceNumber);
    if (key && question.options.some(o => o.id === key)) question.correctOptionId = key;
    if (question.options.length < 2) question.warnings.push("Fewer than two options detected; review the source PDF.");
    if (!question.correctOptionId) question.warnings.push("No explicit answer key detected.");
    if (numbers.has(question.sourceNumber)) question.warnings.push("Repeated source number: check whether this PDF contains multiple sessions.");
    numbers.add(question.sourceNumber);
    if (question.caseTitle && !question.caseDescription) question.warnings.push("Case description was not detected.");
  }
  if (!questions.length) warnings.push("No structured questions detected. Scanned or unusual PDFs require manual transcription/review.");
  warnings.push("Extraction is a draft. Compare every question, case, option and answer key with the original PDF. Separate multiple sessions before publishing.");
  const detectedYears = [...new Set([...text.matchAll(/\b(?:19|20|21)\d{2}\b/g)].map(m => Number(m[0])))];
  return { questions, detectedYears, warnings };
}
