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

/** One element designed as a single A4: exactly one page when it fits, clean
 *  full-height slices only on genuine overflow. */
export async function downloadPdfFromElement(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await render(el);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const imgHmm = (canvas.height * PAGE_W) / canvas.width;

  if (imgHmm <= PAGE_H + 2) {
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, Math.min(imgHmm, PAGE_H));
  } else {
    const pageCanvasH = Math.floor((canvas.width * PAGE_H) / PAGE_W);
    let offset = 0;
    let first = true;
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
  }
  doc.save(filename);
}

/** Multi-sheet documents (e.g. the OTP's `.page` A4 sheets): each element
 *  becomes exactly one PDF page, in order. */
export async function downloadPdfFromPages(pages: HTMLElement[], filename: string): Promise<void> {
  if (pages.length === 0) return;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  for (let i = 0; i < pages.length; i++) {
    const canvas = await render(pages[i]);
    const h = Math.min((canvas.height * PAGE_W) / canvas.width, PAGE_H);
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, h);
  }
  doc.save(filename);
}

export const pdfFilename = (prefix: string, ...parts: Array<string | null | undefined>): string =>
  [prefix, ...parts.map((p) => String(p ?? '').trim()).filter(Boolean)]
    .map((s) => s.replace(/[^\w-]+/g, '_'))
    .join('-') + '.pdf';
