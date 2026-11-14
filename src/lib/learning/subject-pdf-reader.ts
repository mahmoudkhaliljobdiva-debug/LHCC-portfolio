import type { SubjectPdfPage } from "@/lib/learning/subject-extraction";

export async function readSubjectPdf(file: File, progress: (page: number, total: number) => void): Promise<SubjectPdfPage[]> {
  if (file.size > 200 * 1024 * 1024) throw new Error("This PDF is larger than 200 MB. Use reviewed source sections with preserved original page references.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), enableXfa: false });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 2000) throw new Error("Split this source into reviewed sections before importing more than 2,000 pages.");
    const pages: SubjectPdfPage[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), content = await page.getTextContent();
      let text = "", previousY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (previousY !== null && Math.abs(y - previousY) > 3 && !text.endsWith("\n")) text += "\n";
        text += item.str + (item.hasEOL ? "\n" : " "); previousY = y;
      }
      const operators = await page.getOperatorList();
      const hasImages = operators.fnArray.some(value => value === pdfjs.OPS.paintImageXObject || value === pdfjs.OPS.paintInlineImageXObject);
      pages.push({ page: i, text, hasImages }); page.cleanup(); progress(i, pdf.numPages);
    }
    return pages;
  } finally { await task.destroy(); }
}
