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
  email?: string;
  phone?: string;
}

export interface DealInvoiceData {
  invoiceNumber: string;
  date: string;                  // display string, e.g. "18 Jun 2026"
  billTo: DealInvoiceParty;
  onBehalfOf?: string;           // client name, shown when the bill-to is a finance house
  vehicleLines?: string[];       // full vehicle details, pre-formatted ("Make: …", "VIN: …", …). Omit for a general (non-vehicle) invoice.
  notes?: string;                // optional free-text note printed under the totals
  paymentReference?: string;     // reference the payer should use; falls back to the invoice number
  lineItems: { description: string; amount: number }[];
}

const GOLD: [number, number, number] = [212, 175, 55];
const fmt = (n: number): string =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const generateDealInvoicePDF = (invoice: DealInvoiceData, settings: DocumentSettings) => {
  // VAT-registered status is an explicit toggle. Backward-compat: older saved settings
  // (no flag) fall back to "registered if a VAT number + positive rate were configured".
  const registered = settings.vatRegistered ?? (!!(settings.companyVatNumber && settings.companyVatNumber.trim()) && (settings.vatPercent || 0) > 0);
  const vatRate = registered ? (settings.vatPercent || 0) : 0; // a registered vendor may still charge 0%
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
    settings.companyAddress,
    [settings.companyPhone, settings.companyEmail].filter(Boolean).join('  •  '),
    [registered ? `VAT: ${settings.companyVatNumber}` : '', settings.companyRegNumber ? `Reg: ${settings.companyRegNumber}` : ''].filter(Boolean).join('   '),
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

  // ── Bill To (+ Vehicle, only when vehicle details are supplied) ──
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
  const total = invoice.lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const vatAmount = vatRate > 0 ? total * (vatRate / (100 + vatRate)) : 0;
  const subtotalExcl = total - vatAmount;

  autoTable(doc, {
    startY: y,
    head: [['Description', registered ? 'Amount (incl. VAT)' : 'Amount']],
    body: invoice.lineItems.map((i) => [i.description, fmt(i.amount)]),
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
