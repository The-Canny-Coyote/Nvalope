import type { PDFPageProxy } from 'pdfjs-dist';

/** Build lines using PDF.js end-of-line hints so columns are not glued into one long line. */
export async function extractPageTextWithLineBreaks(page: PDFPageProxy): Promise<string> {
  const tc = await page.getTextContent();
  let line = '';
  let pageOut = '';
  for (const item of tc.items) {
    if (!('str' in item)) continue;
    const ti = item as { str: string; hasEOL?: boolean };
    line += ti.str;
    if (ti.hasEOL) {
      const t = line.trim();
      if (t) pageOut += `${t}\n`;
      line = '';
    }
  }
  if (line.trim()) pageOut += `${line.trim()}\n`;
  return pageOut;
}
