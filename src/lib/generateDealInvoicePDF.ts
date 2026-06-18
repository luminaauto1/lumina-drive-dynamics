// Deal invoice PDF for the Accounting & VAT hub. Bills the correct party — the
// customer (direct sale) or the finance house that bought the car for the client
// (finance sale) — and prints only the line items the operator ticked at finalize.
//
// VAT-ready: while the business is NOT VAT-registered (no VAT number configured),
// the document is titled "INVOICE" and VAT shows as 0%. The moment a VAT number +
// rate are set in Document Settings, the same code prints a proper "TAX INVOICE"
// with the embedded VAT portion — no further changes needed.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';

export interface DealInvoiceParty {
  name: string;
  regOrId?: string;   // company reg or client ID number
  vatNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface DealInvoiceData {
  invoiceNumber: string;
  date: string;                 // display string, e.g. "18 Jun 2026"
  billTo: DealInvoiceParty;
  onBehalfOf?: string;          // client name, shown when the bill-to is a finance house
  vehicleLabel?: string;
  vin?: string;
  reg?: string;
  lineItems: { description: string; amount: number }[];
}

const GOLD: [number, number, number] = [212, 175, 55];
const fmt = (n: number): string =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const generateDealInvoicePDF = (invoice: DealInvoiceData, settings: DocumentSettings) => {
  // VAT-registered only when a VAT number AND a positive rate are configured.
  const registered = !!(settings.companyVatNumber && settings.companyVatNumber.trim()) && (settings.vatPercent || 0) > 0;
  const vatRate = registered ? settings.vatPercent : 0;
  const title = registered ? 'TAX INVOICE' : 'INVOICE';

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // ── Header: company identity (left) + INVOICE / TAX INVOICE (right) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GOLD);
  doc.text(settings.companyTradingName || 'Lumina Auto', margin, y);

  doc.setTextColor(40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let cy = y + 5;
  const companyLines = [
    settings.companyLegalName,
    settings.companyAddress,
    [settings.companyPhone, settings.companyEmail].filter(Boolean).join(' • '),
    [registered ? `VAT: ${settings.companyVatNumber}` : '', settings.companyRegNumber ? `Reg: ${settings.companyRegNumber}` : ''].filter(Boolean).join('  '),
  ].filter(Boolean) as string[];
  companyLines.forEach((line) => { doc.text(line, margin, cy); cy += 4; });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text(title, pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageW - margin, y + 6, { align: 'right' });
  doc.text(`Date: ${invoice.date}`, pageW - margin, y + 11, { align: 'right' });

  y = Math.max(cy, y + 16) + 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Bill To + Vehicle ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text('BILL TO', margin, y);
  doc.text('VEHICLE', pageW / 2 + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40);

  const billLines = [
    invoice.billTo.name,
    invoice.billTo.regOrId || '',
    invoice.billTo.vatNumber ? `VAT: ${invoice.billTo.vatNumber}` : '',
    invoice.billTo.address || '',
    invoice.billTo.email || '',
    invoice.billTo.phone || '',
    invoice.onBehalfOf ? `On behalf of: ${invoice.onBehalfOf}` : '',
  ].filter(Boolean) as string[];
  const vehLines = [
    invoice.vehicleLabel || '',
    invoice.vin ? `VIN: ${invoice.vin}` : '',
    invoice.reg ? `Reg: ${invoice.reg}` : '',
  ].filter(Boolean) as string[];

  let by = y + 5;
  billLines.forEach((l) => { doc.text(l, margin, by); by += 4.5; });
  let vy = y + 5;
  vehLines.forEach((l) => { doc.text(l, pageW / 2 + 4, vy); vy += 4.5; });
  y = Math.max(by, vy) + 4;

  // ── Line items + totals ──
  const total = invoice.lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  // With a real VAT rate, retail amounts are treated as VAT-inclusive (SA convention)
  // and VAT is the embedded portion. At 0% there is no VAT and excl == total.
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
    headStyles: { fillColor: GOLD, textColor: 20, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore - lastAutoTable is added by jspdf-autotable
  y = (doc as any).lastAutoTable.finalY + 8;

  if (!registered) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Not a VAT vendor — no VAT charged.', margin, y);
    y += 8;
  }

  // ── Banking details ──
  if (settings.bankName || settings.bankAccountNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('BANKING DETAILS', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
    const bankLines = [
      settings.bankAccountName ? `Account Name: ${settings.bankAccountName}` : '',
      settings.bankName ? `Bank: ${settings.bankName}` : '',
      settings.bankAccountNumber ? `Account No: ${settings.bankAccountNumber}` : '',
      [settings.bankBranchCode ? `Branch: ${settings.bankBranchCode}` : '', settings.bankAccountType ? `Type: ${settings.bankAccountType}` : ''].filter(Boolean).join('  '),
      `Reference: ${invoice.invoiceNumber}`,
    ].filter(Boolean) as string[];
    let yy = y + 5;
    bankLines.forEach((l) => { doc.text(l, margin, yy); yy += 4.5; });
    y = yy + 4;
  }

  // ── Terms ──
  if (settings.invoiceTerms) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(110);
    const wrapped = doc.splitTextToSize(settings.invoiceTerms, pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4 + 4;
  }

  // ── Footer ──
  const footY = doc.internal.pageSize.getHeight() - 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `${settings.companyLegalName || settings.companyTradingName} • ${title} ${invoice.invoiceNumber}`,
    pageW / 2, footY, { align: 'center' },
  );

  doc.save(`${title.replace(' ', '-')}-${invoice.invoiceNumber}-${(invoice.billTo.name || 'party').replace(/\s+/g, '_')}.pdf`);
};
