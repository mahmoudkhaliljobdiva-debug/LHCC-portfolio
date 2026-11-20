/** Runs only in the admin browser. No PDF content is sent to a third-party parser. */
export async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), enableXfa: false });
  const document = await task.promise;
  try {
    if (document.numPages > 200) throw new Error("Split PDFs longer than 200 pages into examination sessions.");
    const pages: string[] = [];
    for (let i=1;i<=document.numPages;i++) {
      const page = await document.getPage(i); const content = await page.getTextContent();
      let previousY: number | null = null; let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (previousY !== null && Math.abs(y-previousY)>3 && !text.endsWith("\n")) text += "\n";
        text += item.str + (item.hasEOL ? "\n" : " "); previousY = y;
      }
      pages.push(text); page.cleanup();
    }
    return pages.join("\n\n");
  } finally { await task.destroy(); }
}
