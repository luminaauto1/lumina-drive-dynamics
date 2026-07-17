// Shared DOM → PDF download (Invoice Creator, OTP Generator, any A4 document
// tool). Renders via html-to-image (SVG foreignObject = the browser's OWN text
// renderer — html2canvas mangled letter-spaced Montserrat text) and saves a
// real jsPDF straight to Downloads: no print dialog, no save-as prompt, no
// print-CSS page-count surprises.
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

const PAGE_W = 210; // mm
const PAGE_H = 297; // mm

const render = (el: HTMLElement) =>
  toCanvas(el, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });

/** Place a rendered canvas into the PDF: one page when it fits the A4 ratio,
 *  clean full-height slices when taller — NEVER squashed to fit (squashing is
 *  what displaces signature lines and text). */
function addCanvasAsPages(doc: jsPDF, canvas: HTMLCanvasElement, first: boolean): boolean {
  const imgHmm = (canvas.height * PAGE_W) / canvas.width;
  if (imgHmm <= PAGE_H + 2) {
    if (!first) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, Math.min(imgHmm, PAGE_H));
    return false;
  }
  const pageCanvasH = Math.floor((canvas.width * PAGE_H) / PAGE_W);
  let offset = 0;
  while (offset < canvas.height) {
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.min(pageCanvasH, canvas.height - offset);
    const ctx = slice.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (!first) doc.addPage();
    doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, (slice.height * PAGE_W) / canvas.width);
    first = false;
    offset += pageCanvasH;
  }
  return false;
}

/** One element designed as a single A4: exactly one page when it fits, clean
 *  full-height slices only on genuine overflow. */
export async function downloadPdfFromElement(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await render(el);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  addCanvasAsPages(doc, canvas, true);
  doc.save(filename);
}

/** Multi-sheet documents (e.g. the OTP's `.page` A4 sheets): each element
 *  becomes one PDF page (or a clean run of pages if a sheet grew taller than
 *  A4 — content is never squashed). */
export async function downloadPdfFromPages(pages: HTMLElement[], filename: string): Promise<void> {
  if (pages.length === 0) return;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let first = true;
  for (const page of pages) {
    const canvas = await render(page);
    addCanvasAsPages(doc, canvas, first);
    first = false;
  }
  doc.save(filename);
}

export const pdfFilename = (prefix: string, ...parts: Array<string | null | undefined>): string =>
  [prefix, ...parts.map((p) => String(p ?? '').trim()).filter(Boolean)]
    .map((s) => s.replace(/[^\w-]+/g, '_'))
    .join('-') + '.pdf';
