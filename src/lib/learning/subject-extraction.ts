import { extractExamText } from "@/lib/exams/pdf-extraction";

export interface SubjectPdfPage { readonly page: number; readonly text: string; readonly hasImages: boolean; readonly independentPage?: boolean }
interface SubjectExtraction {
  warnings: string[];
  questions: { question: ReturnType<typeof extractExamText>["questions"][number]; pageStart: number; pageEnd: number; warnings: string[] }[];
}

export function completeSubjectText(question: { text: string; caseTitle?: string; caseDescription?: string }) {
  return [question.caseTitle, question.caseDescription, question.text].filter(value => value?.trim()).join("\n\n");
}

/** Preserve page boundaries and source wording. Never infer a medical answer or approve a draft. */
export function extractSubjectPages(pages: readonly SubjectPdfPage[]): SubjectExtraction {
  if (pages.some(page => page.independentPage)) {
    const groups: SubjectPdfPage[][] = [];
    for (const page of pages) {
      const previous = groups[groups.length - 1];
      if (page.independentPage || !previous || previous[0]?.independentPage) groups.push([page]);
      else previous.push(page);
    }
    const results = groups.map(group => extractSubjectPages(group.map(page => ({ ...page, independentPage: false }))));
    return { questions: results.flatMap(result => result.questions), warnings: results.flatMap(result => result.warnings) };
  }
  const prepared = pages.map(page => {
    const lines = page.text.split("\n").map(line => line.trim()
      .replace(/^[O0○◯©]\s*([A-J])\s*[.)]\s*/i, "$1. ")
      .replace(/^([A-J])\s*[.)]\s*(\S.*)$/i, "$1. $2")
      .replace(/^(\d{1,4})\s*[.)]\s*([^\d\s].*)$/, "$1. $2"));
    const options = lines.filter(line => /^[A-J]\s*[.)]\s*\S/i.test(line));
    const hasNumber = lines.some(line => /^(?:question\s+)?\d+\s*[.)]\s+\S/i.test(line));
    // A complete single-page MCQ can lack a readable number after OCR. The
    // internal marker creates a draft boundary, never a fabricated source number.
    const unnumbered = !hasNumber && options.length >= 2 && !/^[A-J]\s*[.)]/i.test(lines.find(line => line.trim()) ?? "");
    return { ...page, unnumbered, text: (unnumbered ? "0. " : "") + lines.join("\n") };
  });
  const locations: { number: string; start: number; end: number; unnumbered: boolean }[] = [];
  let keyMode = false;
  for (const page of prepared) for (const line of page.text.replaceAll("\r", "").split("\n").map(value => value.trim()).filter(Boolean)) {
    if (/^(answer\s*key|correct\s*answers|corrig[eé])\s*:?$/i.test(line)) keyMode = true;
    if (keyMode) continue;
    const match = line.match(/^(?:question\s+)?(\d+)\s*[.)]\s+(.+)$/i);
    if (match?.[1]) locations.push({ number: match[1], start: page.page, end: page.page, unnumbered: page.unnumbered && match[1] === "0" });
    else if (locations.length) locations[locations.length - 1]!.end = page.page;
  }
  const extraction = extractExamText(prepared.map(page => page.text).join("\n\n"));
  return { warnings: extraction.warnings, questions: extraction.questions.map((question, index) => {
    const location = locations[index];
    const pageStart = location?.start ?? pages[0]?.page ?? 1, pageEnd = location?.end ?? pageStart;
    const visualReview = pages.some(page => page.page >= pageStart && page.page <= pageEnd && page.hasImages);
    const sourcePage = prepared.find(page => page.page === pageStart);
    const prefix = sourcePage?.text.split(/^(?:question\s+)?\d+\s*[.)]\s+/im)[0] ?? "";
    const responseSet = /response options|for each patient|items are the same/i.test(prefix)
      ? extractExamText("0. " + prefix).questions[0] : undefined;
    const shared = question.options.length === 0 && responseSet && responseSet.options.length >= 2;
    const preserved = shared ? { ...question, text: responseSet.text + "\n\n" + question.text, options: responseSet.options } : question;
    return { question: location?.unnumbered ? { ...preserved, sourceNumber: "", correctOptionId: null } : preserved, pageStart, pageEnd, warnings: [...question.warnings, ...(shared ? ["Shared response options were explicitly printed before the question. Compare the entire response set, including unreadable option markers, before approval."] : []), ...(location?.unnumbered ? ["Original question number is unreadable; compare the source. No number or answer was inferred."] : []), ...(visualReview ? ["Source page contains images. Compare all diagrams and tables manually before approval."] : []), ...(!location || location.number !== question.sourceNumber ? ["Question/page alignment needs manual review."] : [])] };
  }) };
}
