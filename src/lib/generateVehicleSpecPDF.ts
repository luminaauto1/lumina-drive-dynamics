// Vehicle spec sheet / sale breakdown PDF for inventory and sold vehicles.
// Single-page, dense layout: paired vehicle details, photos side-by-side, and the
// financial sections balanced across two columns with a net-profit bar.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';

const GOLD: [number, number, number] = [212, 175, 55];

export interface SpecRow { label: string; value: string }
export interface SpecSection { title: string; rows: SpecRow[]; emphasize?: boolean }
export interface SpecPhoto { dataUrl: string; w: number; h: number }

export interface VehicleSpecData {
  title: string;
  subtitle?: string;
  ref?: string;
  date?: string;
  vehicleRows: SpecRow[];
  photos: SpecPhoto[];
  sections?: SpecSection[];
}

/** Load an image URL and re-encode to a JPEG data URL via canvas, so any source
 *  format (png/webp/jpeg) embeds cleanly and is downsized. Returns null on error. */
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
          resolve({ dataUrl: c.toDataURL('image/jpeg', 0.82), w, h });
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
  const margin = 14;
  const usable = pageW - margin * 2;
  const gap = 8;
  const colW = (usable - gap) / 2;
  let y = 16;

  const label = (text: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GOLD);
    doc.text(text.toUpperCase(), x, yy);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(45);
  };

  // ── Header ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...GOLD);
  doc.text(settings.companyTradingName || 'Lumina Auto', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(45);
  doc.text(data.title, pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(95);
  if (data.subtitle) doc.text(data.subtitle, margin, y + 5.5);
  const metaBits = [data.ref ? `Ref: ${data.ref}` : '', data.date ? data.date : ''].filter(Boolean);
  if (metaBits.length) doc.text(metaBits.join('   •   '), pageW - margin, y + 5.5, { align: 'right' });
  y += 9;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(margin, y, pageW - margin, y); y += 7;

  // ── Vehicle details (paired label/value across full width) ──
  label('Vehicle Details', margin, y); y += 3;
  const rows = data.vehicleRows;
  const paired: any[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i], b = rows[i + 1];
    paired.push([a?.label || '', a?.value || '', b?.label || '', b?.value || '']);
  }
  autoTable(doc, {
    startY: y,
    body: paired,
    theme: 'plain',
    styles: { fontSize: 8.3, cellPadding: 1.2, overflow: 'linebreak' },
    columnStyles: {
      0: { textColor: [125, 125, 125], cellWidth: 24 },
      1: { textColor: [25, 25, 25], fontStyle: 'bold' },
      2: { textColor: [125, 125, 125], cellWidth: 24 },
      3: { textColor: [25, 25, 25], fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Photos (1 → half width, 2 → side by side) ──
  const photos = (data.photos || []).slice(0, 2);
  if (photos.length) {
    label('Photos', margin, y); y += 4;
    const pw = photos.length === 1 ? usable * 0.6 : (usable - gap) / 2;
    let maxH = 0;
    photos.forEach((p, i) => {
      const h = Math.min(44, (p.h / p.w) * pw);
      maxH = Math.max(maxH, h);
      try { doc.addImage(p.dataUrl, 'JPEG', margin + i * (pw + gap), y, pw, h); } catch { /* skip */ }
    });
    y += maxH + 7;
  }

  // ── Financial sections: balanced two columns + full-width emphasis bar ──
  const all = data.sections || [];
  const normal = all.filter((s) => !s.emphasize && s.rows.length);
  const emph = all.filter((s) => s.emphasize && s.rows.length);

  const renderCol = (secs: SpecSection[], x: number, startY: number) => {
    let yy = startY;
    for (const s of secs) {
      label(s.title, x, yy); yy += 2.5;
      autoTable(doc, {
        startY: yy,
        body: s.rows.map((r) => [r.label, r.value]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.0, overflow: 'linebreak' },
        columnStyles: { 0: { textColor: [120, 120, 120] }, 1: { halign: 'right', textColor: [25, 25, 25], fontStyle: 'bold' } },
        margin: { left: x }, tableWidth: colW,
      });
      // @ts-ignore
      yy = (doc as any).lastAutoTable.finalY + 4.5;
    }
    return yy;
  };

  // Greedy balance by estimated height.
  const est = (s: SpecSection) => 6 + s.rows.length * 4.2;
  const left: SpecSection[] = []; const right: SpecSection[] = [];
  let lh = 0, rh = 0;
  for (const s of normal) { if (lh <= rh) { left.push(s); lh += est(s); } else { right.push(s); rh += est(s); } }
  const leftY = renderCol(left, margin, y);
  const rightY = renderCol(right, margin + colW + gap, y);
  y = Math.max(leftY, rightY) + 2;

  for (const s of emph) {
    for (const r of s.rows) {
      doc.setFillColor(244, 244, 244);
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.4);
      doc.rect(margin, y, usable, 10, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
      doc.text(r.label, margin + 4, y + 6.6);
      doc.text(r.value, pageW - margin - 4, y + 6.6, { align: 'right' });
      y += 12;
    }
  }

  // ── Footer ──
  doc.setDrawColor(225); doc.setLineWidth(0.3); doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150);
  doc.text(
    `${settings.companyLegalName || settings.companyTradingName} • ${data.title}${data.ref ? ` ${data.ref}` : ''}`,
    pageW / 2, pageH - 8, { align: 'center' },
  );

  const safe = (data.subtitle || data.title).replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
  doc.save(`${data.title.replace(/\s+/g, '-')}-${safe}.pdf`);
};
