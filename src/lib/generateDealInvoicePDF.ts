// Deal invoice PDF for the Accounting & VAT hub. Bills the correct party — the
// customer (direct sale) or the finance house that bought the car for the client
// (finance sale) — and prints only the line items the operator ticked at finalize.
//
// VAT-ready: VAT status is driven by the "We are VAT registered" toggle in Document
// Settings. When registered, the document is a proper "TAX INVOICE" with a VAT line
// at the configured rate — which may be 0%, i.e. a valid VAT invoice showing VAT
// R0,00 (no VAT charged). When not registered, it's a plain "INVOICE" with no VAT.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';

export interface DealInvoiceParty {
  name: string;
  regOrId?: string;
  vatNumber?: string;
  address?: string;
  postalCode?: string;
  email?: string;
  phone?: string;      // cell
  phoneWork?: string;  // landline / work
}

export interface InvoiceMiscItem {
  description: string;
  amountIncl: number;
  /** true = no VAT on this line even on a tax invoice (e.g. Licence & Registration). */
  vatExempt?: boolean;
}

export interface DealInvoiceData {
  invoiceNumber: string;
  date: string;                  // display string, e.g. "18 Jun 2026"
  billTo: DealInvoiceParty;
  onBehalfOf?: string;           // client name, shown when the bill-to is a finance house
  vehicleLines?: string[];       // legacy pre-formatted vehicle strings. Superseded by vehicleDetails.
  notes?: string;                // optional free-text note printed under the totals
  paymentReference?: string;     // reference the payer should use; falls back to the invoice number
  taxInvoice?: boolean;          // force a TAX INVOICE (e.g. the bill-to vendor is VAT registered); overrides the company setting
  vatRate?: number;              // VAT rate to apply on a tax invoice (0 = zero-rated). Defaults to the company rate.
  lineItems?: { description: string; amount: number }[]; // legacy simple layout (used when no motor-trade fields)

  // ── Motor-trade vehicle-invoice fields (all optional; when soldForIncl or
  //    miscItems are present the full motor-trade layout renders instead) ──
  deliveredTo?: DealInvoiceParty;              // "DELIVERED ON YOUR BEHALF TO" block (the end client)
  vehicleDetails?: { label: string; value: string }[]; // USED VEHICLE DETAILS grid
  vehicleLabel?: string;                       // e.g. "2019 Volkswagen T-Cross 1.0 TSI" for the totals row
  soldForIncl?: number;                        // vehicle price (VAT-incl) → SOLD FOR row
  soldForLabel?: string;                       // override for the SOLD FOR row description (e.g. margin-basis deals)
  miscItems?: InvoiceMiscItem[];               // per-line VAT handling (Licence & Reg = exempt)
  depositPaid?: number;
  tradeInDeposit?: number;
  conditions?: string;                         // Conditions of Sale override (falls back to settings.invoiceConditions)
}

const GOLD: [number, number, number] = [212, 175, 55];
const fmt = (n: number): string =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** VAT portion of a VAT-inclusive amount at the given rate. */
export const vatOfIncl = (incl: number, rate: number): number =>
  rate > 0 ? incl * (rate / (100 + rate)) : 0;

export interface InvoiceTotals {
  vehVat: number; vehExcl: number;
  miscIncl: number; miscVat: number; miscExcl: number;
  grandIncl: number; totalVat: number; subtotalExcl: number;
  principal: number;
}

/** Single source of truth for the motor-trade invoice math — used by the PDF
 *  renderer, the creator's live totals panel, and the saved grand_total. */
export const computeInvoiceTotals = (
  data: Pick<DealInvoiceData, 'soldForIncl' | 'miscItems' | 'depositPaid' | 'tradeInDeposit'>,
  vatRate: number,
): InvoiceTotals => {
  const soldIncl = data.soldForIncl ?? 0;
  const vehVat = data.soldForIncl != null ? vatOfIncl(soldIncl, vatRate) : 0;
  const misc = data.miscItems || [];
  const miscIncl = misc.reduce((s, m) => s + (m.amountIncl || 0), 0);
  const miscVat = misc.reduce((s, m) => s + (m.vatExempt ? 0 : vatOfIncl(m.amountIncl || 0, vatRate)), 0);
  const grandIncl = soldIncl + miscIncl;
  const totalVat = vehVat + miscVat;
  return {
    vehVat, vehExcl: soldIncl - vehVat,
    miscIncl, miscVat, miscExcl: miscIncl - miscVat,
    grandIncl, totalVat, subtotalExcl: grandIncl - totalVat,
    principal: grandIncl - (data.depositPaid || 0) - (data.tradeInDeposit || 0),
  };
};

export const generateDealInvoicePDF = (invoice: DealInvoiceData, settings: DocumentSettings) => {
  // A TAX INVOICE is issued when the caller forces it (e.g. the bill-to vendor is VAT
  // registered) or our own company is VAT registered. Falls back to the legacy
  // "has a VAT number + positive rate" rule for older saved settings.
  const registered = invoice.taxInvoice
    ?? settings.vatRegistered
    ?? (!!(settings.companyVatNumber && settings.companyVatNumber.trim()) && (settings.vatPercent || 0) > 0);
  // The rate the caller asked for (0 = zero-rated, valid while we're not VAT registered),
  // otherwise the company rate. Only applied on a tax invoice.
  const vatRate = registered ? (invoice.vatRate ?? settings.vatPercent ?? 0) : 0;
  const title = registered ? 'TAX INVOICE' : 'INVOICE';

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const colGap = 10;
  const colX = pageW / 2 + colGap / 2; // right-column x for VEHICLE
  let y = 20;

  // Render text lines at x, splitting embedded newlines and wrapping to maxW.
  const drawBlock = (lines: string[], x: number, startY: number, maxW: number, lh = 5) => {
    let yy = startY;
    for (const raw of lines) {
      for (const seg of String(raw ?? '').split(/\r?\n/)) {
        const t = seg.trim();
        if (!t) continue;
        for (const w of doc.splitTextToSize(t, maxW) as string[]) { doc.text(w, x, yy); yy += lh; }
      }
    }
    return yy;
  };
  const sectionLabel = (text: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GOLD);
    doc.text(text, x, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(45);
  };

  // ── Header: company identity (left) + INVOICE / TAX INVOICE (right) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...GOLD);
  doc.text(settings.companyTradingName || 'Lumina Auto', margin, y);

  doc.setTextColor(70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const companyLines = [
    settings.companyLegalName,
    settings.companyRegNumber ? `Reg: ${settings.companyRegNumber}` : '',
    settings.companyAddress,
    [settings.companyPhone, settings.companyEmail].filter(Boolean).join('  •  '),
    registered && settings.companyVatNumber ? `VAT: ${settings.companyVatNumber}` : '',
  ].filter(Boolean) as string[];
  const cyEnd = drawBlock(companyLines, margin, y + 6, pageW / 2 - margin, 4.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(45);
  doc.text(title, pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageW - margin, y + 7, { align: 'right' });
  doc.text(`Date: ${invoice.date}`, pageW - margin, y + 12.5, { align: 'right' });

  y = Math.max(cyEnd, y + 18) + 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 11;

  // Motor-trade layout kicks in when the caller supplies ANY motor-trade field
  // (a vehicle sold-for price, per-line-VAT misc items, or a vehicle detail
  // grid); otherwise the legacy simple layout renders byte-for-byte as before.
  const motor = invoice.soldForIncl != null
    || (invoice.miscItems && invoice.miscItems.length > 0)
    || (invoice.vehicleDetails && invoice.vehicleDetails.length > 0);

  const partyLines = (p: DealInvoiceParty): string[] => [
    p.name,
    p.regOrId || '',
    p.vatNumber ? `VAT: ${p.vatNumber}` : '',
    p.address || '',
    p.postalCode ? `Postal code: ${p.postalCode}` : '',
    p.phoneWork ? `Tel (W): ${p.phoneWork}` : '',
    p.phone ? `Tel: ${p.phone}` : '',
    p.email || '',
  ].filter(Boolean) as string[];

  if (motor) {
    // ── INVOICED TO | DELIVERED ON YOUR BEHALF TO ──
    sectionLabel('INVOICED TO', margin, y);
    if (invoice.deliveredTo?.name) sectionLabel('DELIVERED ON YOUR BEHALF TO', colX, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(45);
    const by = drawBlock(partyLines(invoice.billTo), margin, y + 6, pageW / 2 - margin - colGap);
    const dy = invoice.deliveredTo?.name
      ? drawBlock(partyLines(invoice.deliveredTo), colX, y + 6, pageW / 2 - margin - colGap / 2)
      : y + 6;
    y = Math.max(by, dy) + 6;

    // ── USED VEHICLE DETAILS grid (label/value pairs, two per row) ──
    const details = (invoice.vehicleDetails || []).filter((r) => r && String(r.value ?? '').trim() !== '');
    if (details.length) {
      sectionLabel('USED VEHICLE DETAILS', margin, y);
      const gridBody: string[][] = [];
      for (let i = 0; i < details.length; i += 2) {
        const a = details[i]; const b = details[i + 1];
        gridBody.push([a.label, a.value, b?.label || '', b?.value || '']);
      }
      autoTable(doc, {
        startY: y + 3,
        body: gridBody,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: 80, cellWidth: 32 },
          2: { fontStyle: 'bold', textColor: 80, cellWidth: 32 },
        },
        margin: { left: margin, right: margin },
      });
      // @ts-ignore - lastAutoTable is added by jspdf-autotable
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── SOLD FOR + MISCELLANEOUS ITEMS (Incl | VAT | Excl per line) ──
    const misc = invoice.miscItems || [];
    const soldIncl = invoice.soldForIncl ?? null;
    const t = computeInvoiceTotals(invoice, vatRate);
    const vehLabel = (invoice.vehicleLabel || 'Vehicle').toUpperCase();

    const bold = (content: string) => ({ content, styles: { fontStyle: 'bold' as const } });
    const body: any[][] = [];
    if (soldIncl != null) {
      const soldDesc = invoice.soldForLabel || `${invoice.vehicleLabel || 'Vehicle'} — SOLD FOR`;
      body.push([bold(soldDesc), bold(fmt(soldIncl)), bold(fmt(t.vehVat)), bold(fmt(t.vehExcl))]);
    }
    for (const m of misc) {
      const vat = m.vatExempt ? 0 : vatOfIncl(m.amountIncl || 0, vatRate);
      body.push([m.description, fmt(m.amountIncl || 0), fmt(vat), fmt((m.amountIncl || 0) - vat)]);
    }

    const foot: any[][] = [
      ['MISCELLANEOUS ITEMS TOTAL (excl)', '', '', fmt(t.miscExcl)],
      ...(soldIncl != null ? [[`1 X ${vehLabel} (excl)`, '', '', fmt(t.vehExcl)]] : []),
      ['SUBTOTAL (excl)', '', '', fmt(t.subtotalExcl)],
      [`VAT @ ${vatRate}%`, '', '', fmt(t.totalVat)],
      [bold('GRAND TOTAL'), '', '', bold(fmt(t.grandIncl))],
      ['DEPOSIT PAID', '', '', fmt(invoice.depositPaid || 0)],
      ['TRADE-IN DEPOSIT', '', '', fmt(invoice.tradeInDeposit || 0)],
      [bold('PRINCIPAL DEBT'), '', '', bold(fmt(t.principal))],
    ];

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Value (Incl)', 'VAT', 'Total (Excl)']],
      body,
      foot,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: GOLD, textColor: 20, fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], textColor: 20 },
      columnStyles: {
        1: { halign: 'right', cellWidth: 34 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 34 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-ignore - lastAutoTable is added by jspdf-autotable
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Conditions of Sale ──
    const conditions = (invoice.conditions ?? settings.invoiceConditions ?? '').trim();
    if (conditions) {
      if (y > pageH - 60) { doc.addPage(); y = 20; }
      sectionLabel('CONDITIONS OF SALE', margin, y);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(110);
      const wrapped = doc.splitTextToSize(conditions, pageW - margin * 2);
      doc.text(wrapped, margin, y + 5);
      y += wrapped.length * 3.4 + 12;
    }
  } else {
    // ── Legacy: Bill To (+ Vehicle, only when vehicle details are supplied) ──
    const vehLines = (invoice.vehicleLines || []).filter(Boolean);
    const hasVehicle = vehLines.length > 0;
    sectionLabel('BILL TO', margin, y);
    if (hasVehicle) sectionLabel('VEHICLE', colX, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(45);

    const billLines = [
      invoice.billTo.name,
      invoice.billTo.regOrId || '',
      invoice.billTo.vatNumber ? `VAT: ${invoice.billTo.vatNumber}` : '',
      invoice.billTo.address || '',
      invoice.billTo.email || '',
      invoice.billTo.phone || '',
      invoice.onBehalfOf ? `On behalf of: ${invoice.onBehalfOf}` : '',
    ].filter(Boolean) as string[];

    const by = drawBlock(billLines, margin, y + 6, hasVehicle ? pageW / 2 - margin - colGap : pageW - margin * 2);
    const vy = hasVehicle ? drawBlock(vehLines, colX, y + 6, pageW / 2 - margin - colGap / 2) : y + 6;
    y = Math.max(by, vy) + 6;

    // ── Line items + totals ──
    const items = invoice.lineItems || [];
    const total = items.reduce((s, i) => s + (i.amount || 0), 0);
    const vatAmount = vatRate > 0 ? total * (vatRate / (100 + vatRate)) : 0;
    const subtotalExcl = total - vatAmount;

    autoTable(doc, {
      startY: y,
      head: [['Description', registered ? 'Amount (incl. VAT)' : 'Amount']],
      body: items.map((i) => [i.description, fmt(i.amount)]),
      foot: [
        ['Subtotal (excl. VAT)', fmt(subtotalExcl)],
        [`VAT (${vatRate}%)`, fmt(vatAmount)],
        ['Total Due', fmt(total)],
      ],
      theme: 'striped',
      styles: { fontSize: 9.5, cellPadding: 3 },
      headStyles: { fillColor: GOLD, textColor: 20, fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 55 } },
      margin: { left: margin, right: margin },
    });

    // @ts-ignore - lastAutoTable is added by jspdf-autotable
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (invoice.notes && invoice.notes.trim()) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
    const wrapped = doc.splitTextToSize(invoice.notes.trim(), pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.5 + 6;
  }

  if (!registered) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text('Not a VAT vendor — no VAT charged.', margin, y);
    y += 10;
  }

  // ── Banking details ──
  if (settings.bankName || settings.bankAccountNumber) {
    if (y > pageH - 55) { doc.addPage(); y = 20; }
    sectionLabel('BANKING DETAILS', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(45);
    const bankLines = [
      settings.bankAccountName ? `Account Name: ${settings.bankAccountName}` : '',
      settings.bankName ? `Bank: ${settings.bankName}` : '',
      settings.bankAccountNumber ? `Account No: ${settings.bankAccountNumber}` : '',
      [settings.bankBranchCode ? `Branch: ${settings.bankBranchCode}` : '', settings.bankAccountType ? `Type: ${settings.bankAccountType}` : ''].filter(Boolean).join('    '),
      `Reference: ${(invoice.paymentReference && invoice.paymentReference.trim()) || invoice.invoiceNumber}`,
    ].filter(Boolean) as string[];
    y = drawBlock(bankLines, margin, y + 6, pageW - margin * 2) + 6;
  }

  // ── Terms ──
  if (settings.invoiceTerms) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const wrapped = doc.splitTextToSize(settings.invoiceTerms, pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4 + 4;
  }

  // ── Footer ──
  doc.setDrawColor(225);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text(
    `${settings.companyLegalName || settings.companyTradingName} • ${title} ${invoice.invoiceNumber}`,
    pageW / 2, pageH - 9, { align: 'center' },
  );

  doc.save(`${title.replace(' ', '-')}-${invoice.invoiceNumber}-${(invoice.billTo.name || 'party').replace(/\s+/g, '_')}.pdf`);
};
