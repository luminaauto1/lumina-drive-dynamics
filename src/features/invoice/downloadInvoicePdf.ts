// Direct PDF download for the invoice preview (owner 2026-07-17: "click
// download and it should download, not ask me where to save" + the print-CSS
// route produced 5-page PDFs). Renders the on-screen InvoiceDocument DOM to a
// canvas and places it on a REAL A4 jsPDF that saves straight to Downloads —
// same behaviour as every other PDF in the app (doc.save()).
//
// The document is designed as a single A4; content that fits within one page
// is placed on exactly ONE page (no stray blank pages possible). If it ever
// overflows (very long item lists), it splits into clean full-height slices.
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_W = 210; // mm
const PAGE_H = 297; // mm

export async function downloadInvoicePdf(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(el, {
    scale: 2,               // crisp text
    useCORS: true,          // company logo from storage
    logging: false,
    backgroundColor: '#ffffff',
  });

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const imgHmm = (canvas.height * PAGE_W) / canvas.width;

  if (imgHmm <= PAGE_H + 2) {
    // The designed case: one A4 page, scaled to fit exactly.
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, Math.min(imgHmm, PAGE_H));
  } else {
    // Overflow fallback: slice the canvas into consecutive A4-height pages.
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

export const invoiceFilename = (invoiceNumber: string, billToName: string): string =>
  `Invoice-${(invoiceNumber || 'draft').replace(/[^\w-]+/g, '_')}-${(billToName || 'client').trim().replace(/[^\w-]+/g, '_')}.pdf`;
