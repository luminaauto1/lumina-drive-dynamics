// Vehicle spec sheet / sale breakdown PDF for inventory and sold vehicles.
// Lists every captured vehicle detail, embeds up to 2 photos, and (for a sale)
// the full financial breakdown shown on the Accounting & VAT page.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';

const GOLD: [number, number, number] = [212, 175, 55];

export interface SpecRow { label: string; value: string }
export interface SpecSection { title: string; rows: SpecRow[]; emphasize?: boolean }
export interface SpecPhoto { dataUrl: string; w: number; h: number }

export interface VehicleSpecData {
  title: string;            // e.g. "VEHICLE SPEC SHEET" or "SALE BREAKDOWN"
  subtitle?: string;        // e.g. "2026 Mahindra Pik Up"
  ref?: string;             // stock no / deal ref
  date?: string;            // display date
  vehicleRows: SpecRow[];
  photos: SpecPhoto[];
  sections?: SpecSection[]; // pricing / sale breakdown / itemised lines
}

/** Load an image URL and re-encode to a JPEG data URL via canvas, so any source
 *  format (png/webp/jpeg) embeds cleanly and is downsized. Returns null on CORS/load error. */
export const loadVehicleImage = (url: string, maxW = 900): Promise<SpecPhoto | null> =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const nW = img.naturalWidth || maxW;
          const nH = img.naturalHeight || Math.round(maxW * 0.66);
          const scale = Math.min(1, maxW / nW);
          const w = Math.max(1, Math.round(nW * scale));
          const h = Math.max(1, Math.round(nH * scale));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: c.toDataURL('image/jpeg', 0.85), w, h });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch { resolve(null); }
  });

export const generateVehicleSpecPDF = (data: VehicleSpecData, settings: DocumentSettings) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = 18;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 16) { doc.addPage(); y = 18; }
  };
  const sectionLabel = (text: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GOLD);
    doc.text(text, margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(45);
  };

  // ── Header ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...GOLD);
  doc.text(settings.companyTradingName || 'Lumina Auto', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(45);
  doc.text(data.title, pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  let metaY = y + 6;
  if (data.ref) { doc.text(`Ref: ${data.ref}`, pageW - margin, metaY, { align: 'right' }); metaY += 5; }
  if (data.date) { doc.text(`Date: ${data.date}`, pageW - margin, metaY, { align: 'right' }); metaY += 5; }
  doc.setFontSize(10); doc.setTextColor(60);
  if (data.subtitle) doc.text(data.subtitle, margin, y + 6);
  y = Math.max(y + 12, metaY) + 2;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(margin, y, pageW - margin, y); y += 9;

  // ── Vehicle details (2-col label/value table) ──
  sectionLabel('VEHICLE DETAILS');
  autoTable(doc, {
    startY: y,
    body: data.vehicleRows.map((r) => [r.label, r.value]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { textColor: [120, 120, 120], cellWidth: 55 }, 1: { textColor: [30, 30, 30], fontStyle: 'bold' } },
    margin: { left: margin, right: pageW / 2 },
    tableWidth: pageW / 2 - margin,
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Photos (up to 2, side by side in the top-right not used; place full-width row) ──
  const photos = (data.photos || []).slice(0, 2);
  if (photos.length) {
    ensureSpace(60);
    sectionLabel('PHOTOS');
    const gap = 6;
    const boxW = (pageW - margin * 2 - gap) / 2;
    let maxH = 0;
    photos.forEach((p, i) => {
      const w = boxW;
      const h = Math.min(70, (p.h / p.w) * w);
      maxH = Math.max(maxH, h);
      try { doc.addImage(p.dataUrl, 'JPEG', margin + i * (boxW + gap), y, w, h); } catch { /* skip */ }
    });
    y += maxH + 8;
  }

  // ── Extra sections (pricing / sale breakdown / itemised lines) ──
  for (const s of data.sections || []) {
    if (!s.rows.length) continue;
    ensureSpace(14 + s.rows.length * 6);
    sectionLabel(s.title.toUpperCase());
    autoTable(doc, {
      startY: y,
      body: s.rows.map((r) => [r.label, r.value]),
      theme: s.emphasize ? 'grid' : 'plain',
      styles: { fontSize: s.emphasize ? 10 : 9, cellPadding: s.emphasize ? 2.5 : 1.5 },
      columnStyles: {
        0: { textColor: s.emphasize ? [20, 20, 20] : [120, 120, 120], fontStyle: s.emphasize ? 'bold' : 'normal' },
        1: { halign: 'right', textColor: [30, 30, 30], fontStyle: 'bold' },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  // ── Footer ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(225); doc.setLineWidth(0.3); doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150);
    doc.text(`${settings.companyLegalName || settings.companyTradingName} • ${data.title}${data.ref ? ` ${data.ref}` : ''}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  const safe = (data.subtitle || data.title).replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
  doc.save(`${data.title.replace(/\s+/g, '-')}-${safe}.pdf`);
};
