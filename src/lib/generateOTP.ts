import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface OTPData {
  // Contact Information
  clientName: string;
  idNumber: string;
  address: string;
  email: string;
  cellPhone: string;
  salesExecutive: string;
  date: string;
  quoteRef: string;
  
  // Vehicle Details
  makeModel: string;
  year: string;
  regNo: string;
  vin: string;
  engineNo: string;
  mileage: string;
  color: string;
  
  // Financial
  totalPrice: number;
  extras: { description: string; amount: number }[];
  adminFee: number;
  
  // Signature
  signedPlace: string;
}

const formatCurrency = (amount: number): string => {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const generateOTP = (data: OTPData) => {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor: [number, number, number] = [212, 175, 55]; // Gold
  const textColor: [number, number, number] = [26, 26, 26];
  const mutedColor: [number, number, number] = [102, 102, 102];
  
  let yPos = 15;
  const leftMargin = 15;
  const rightMargin = 195;
  const pageWidth = 180;
  
  // ==================== HEADER ====================
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('LUMINA AUTO', leftMargin, yPos);
  
  yPos += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Pretoria, South Africa', leftMargin, yPos);
  
  yPos += 4;
  doc.text('Email: info@luminaauto.co.za | Cell: 068 601 7462', leftMargin, yPos);
  
  // Title
  yPos += 10;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  
  yPos += 8;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('OFFER TO PURCHASE', 105, yPos, { align: 'center' });
  
  yPos += 5;
  doc.setLineWidth(0.5);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  
  // ==================== SECTION 1: CONTACT INFORMATION ====================
  yPos += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('1. CONTACT INFORMATION', leftMargin, yPos);
  
  yPos += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  const col1X = leftMargin;
  const col2X = 110;
  const lineSpacing = 5;
  
  const addGridRow = (label1: string, value1: string, label2: string, value2: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`${label1}:`, col1X, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(value1 || '[TBA]', col1X + 28, yPos);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`${label2}:`, col2X, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(value2 || '[TBA]', col2X + 28, yPos);
    
    yPos += lineSpacing;
  };
  
  addGridRow('Client Name', data.clientName, 'ID Number', data.idNumber);
  addGridRow('Address', data.address.slice(0, 35) + (data.address.length > 35 ? '...' : ''), 'Email', data.email);
  addGridRow('Cell', data.cellPhone, 'Sales Exec', data.salesExecutive);
  addGridRow('Date', data.date, 'Quote Ref', data.quoteRef);
  
  // ==================== SECTION 2: VEHICLE DETAILS ====================
  yPos += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('2. VEHICLE DETAILS', leftMargin, yPos);
  
  yPos += 6;
  addGridRow('Make & Model', data.makeModel, 'Year', data.year);
  addGridRow('Reg No', data.regNo, 'VIN', data.vin);
  addGridRow('Engine No', data.engineNo, 'Mileage', data.mileage);
  addGridRow('Color', data.color, '', '');
  
  // ==================== SECTION 3: FINANCIAL SUMMARY ====================
  yPos += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('3. FINANCIAL SUMMARY', leftMargin, yPos);
  
  yPos += 6;
  
  // Calculate VAT breakdown
  const vatRate = 0.15;
  const totalIncVAT = data.totalPrice;
  const extrasTotal = data.extras.reduce((sum, e) => sum + e.amount, 0);
  const sellingPriceIncVAT = totalIncVAT - extrasTotal - data.adminFee;
  const sellingPriceExclVAT = sellingPriceIncVAT / (1 + vatRate);
  const extrasExclVAT = extrasTotal / (1 + vatRate);
  const adminExclVAT = data.adminFee / (1 + vatRate);
  const subtotalExclVAT = sellingPriceExclVAT + extrasExclVAT + adminExclVAT;
  const vatAmount = subtotalExclVAT * vatRate;
  
  // Build table data
  const tableData: (string | { content: string; styles: object })[][] = [
    ['Selling Price (Excl. VAT)', formatCurrency(sellingPriceExclVAT)],
  ];
  
  // Add extras if any
  if (data.extras.length > 0) {
    const extrasText = data.extras.map(e => `${e.description}: ${formatCurrency(e.amount)}`).join(', ');
    tableData.push(['Extras / Value Added Products', extrasText]);
  } else {
    tableData.push(['Extras / Value Added Products', 'None']);
  }
  
  tableData.push(['Admin & Fees', formatCurrency(adminExclVAT)]);
  tableData.push([{ content: 'Subtotal (Excl. VAT)', styles: { fontStyle: 'bold' } }, formatCurrency(subtotalExclVAT)]);
  tableData.push(['VAT (15%)', formatCurrency(vatAmount)]);
  tableData.push([
    { content: 'TOTAL COST (Incl. VAT)', styles: { fontStyle: 'bold', fillColor: [245, 245, 220] } },
    { content: formatCurrency(totalIncVAT), styles: { fontStyle: 'bold', fillColor: [245, 245, 220] } }
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Amount']],
    body: tableData,
    margin: { left: leftMargin },
    tableWidth: pageWidth,
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 80, halign: 'right' },
    },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 12;
  
  // ==================== SECTION 4: SIGNATURES ====================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('4. SIGNATURES', leftMargin, yPos);
  
  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(`Signed at ${data.signedPlace || '[PLACE]'} on ${data.date || '[DATE]'}`, leftMargin, yPos);
  
  yPos += 12;
  
  // Purchaser signature
  doc.text('Purchaser:', leftMargin, yPos);
  yPos += 8;
  doc.setDrawColor(...mutedColor);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, yPos, leftMargin + 70, yPos);
  yPos += 4;
  doc.setFontSize(7);
  doc.text('(Signature)', leftMargin, yPos);
  doc.setFontSize(9);
  
  // Lumina Representative signature
  const repX = 110;
  doc.text('Lumina Representative:', repX, yPos - 12);
  doc.line(repX, yPos - 4, repX + 70, yPos - 4);
  doc.setFontSize(7);
  doc.text('(Signature)', repX, yPos);
  
  // ==================== SECTION 5: CONDITIONS OF OFFER ====================
  yPos += 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('5. CONDITIONS OF OFFER', leftMargin, yPos);
  
  yPos += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  
  const termsText = `DEFINITIONS: "I" or "Purchaser" refers to the person whose details appear above. "Lumina" refers to Lumina Auto (Pty) Ltd and its authorized representatives.

RISK: All risk in and to the vehicle shall pass to the Purchaser upon delivery of the vehicle, irrespective of when ownership passes.

OWNERSHIP: Ownership of the vehicle shall remain with Lumina Auto until the full purchase price and all other amounts due have been paid in full.

ACCEPTANCE: This Offer to Purchase is subject to acceptance by Lumina Auto. The sale is concluded only upon written acceptance by Lumina.

DEPOSIT: Any deposit paid is non-refundable should the Purchaser withdraw from this agreement after acceptance by Lumina.

WARRANTY: The vehicle is sold voetstoots (as is) unless otherwise specified in writing. Any warranties are as per the Consumer Protection Act where applicable.

POPIA CONSENT: I hereby consent to Lumina Auto processing my personal information for the purposes of this transaction and related communications, in accordance with the Protection of Personal Information Act (POPIA).

ENTIRE AGREEMENT: This document constitutes the entire agreement between the parties. No amendments shall be valid unless in writing and signed by both parties.`;
  
  const lines = doc.splitTextToSize(termsText, pageWidth);
  lines.forEach((line: string) => {
    if (yPos > 280) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, leftMargin, yPos);
    yPos += 3;
  });
  
  // Footer
  yPos = 287;
  doc.setFontSize(7);
  doc.setTextColor(...mutedColor);
  doc.text('This document is generated by Lumina Auto. For queries, contact info@luminaauto.co.za', 105, yPos, { align: 'center' });
  
  // Save
  const fileName = `OTP_${data.clientName.replace(/\s+/g, '_')}_${data.quoteRef || 'DRAFT'}.pdf`;
  doc.save(fileName);
};
