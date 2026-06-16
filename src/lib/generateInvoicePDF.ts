import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';

export interface InvoiceLineItem { description: string; amount: number; } // VAT-inclusive

export interface InvoiceData {
  invoiceNumber: string;
  date: string;          // display string, e.g. "16 Jun 2026"
  clientName: string;
  idNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  vehicleLabel?: string; // e.g. "2022 Volkswagen Polo"
  vin?: string;
  reg?: string;
  lineItems: InvoiceLineItem[];
}

const GOLD: [number, number, number] = [212, 175, 55];
const fmt = (n: number): string =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Generates and downloads a branded Tax Invoice PDF. Prices are treated as
 *  VAT-inclusive (SA retail convention); VAT is shown as the embedded portion. */
export const generateInvoicePDF = (invoice: InvoiceData, settings: DocumentSettings) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // ── Header: company identity (left) + TAX INVOICE (right) ──
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
    [settings.companyVatNumber ? `VAT: ${settings.companyVatNumber}` : '', settings.companyRegNumber ? `Reg: ${settings.companyRegNumber}` : ''].filter(Boolean).join('  '),
  ].filter(Boolean) as string[];
  companyLines.forEach((line) => { doc.text(line, margin, cy); cy += 4; });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text('TAX INVOICE', pageW - margin, y, { align: 'right' });
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
    invoice.clientName,
    invoice.idNumber ? `ID: ${invoice.idNumber}` : '',
    invoice.address || '',
    invoice.email || '',
    invoice.phone || '',
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

  // ── Line items + totals (VAT-inclusive) ──
  const totalIncl = invoice.lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const vatRate = settings.vatPercent || 15;
  const vatAmount = totalIncl * (vatRate / (100 + vatRate));
  const subtotalExcl = totalIncl - vatAmount;

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Amount (incl. VAT)']],
    body: invoice.lineItems.map((i) => [i.description, fmt(i.amount)]),
    foot: [
      ['Subtotal (excl. VAT)', fmt(subtotalExcl)],
      [`VAT (${vatRate}%)`, fmt(vatAmount)],
      ['Total Due', fmt(totalIncl)],
    ],
    theme: 'striped',
    headStyles: { fillColor: GOLD, textColor: 20, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore - lastAutoTable is added by jspdf-autotable
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Banking details ──
  const hasBank = settings.bankName || settings.bankAccountNumber;
  if (hasBank) {
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
    `${settings.companyLegalName || settings.companyTradingName} • Tax Invoice ${invoice.invoiceNumber}`,
    pageW / 2, footY, { align: 'center' },
  );

  doc.save(`Invoice-${invoice.invoiceNumber}-${(invoice.clientName || 'client').replace(/\s+/g, '_')}.pdf`);
};
