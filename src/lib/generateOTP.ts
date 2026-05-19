import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface OTPData {
  // Client
  clientName: string;
  idNumber: string;
  address: string;
  email: string;
  cellPhone: string;
  salesExecutive: string;
  date: string;
  quoteRef: string;

  // Vehicle
  make: string;
  model: string;
  year: string;
  regNo: string;
  colorVal: string;
  vin: string;
  engineNo: string;
  mileage: string;

  // Financial
  basePrice: number;
  extrasPrice: number;
  vapPrice: number;
  adminFee: number;

  signedPlace: string;
}

const fmt = (n: number): string =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OTP_TERMS: { heading: string; body: string }[] = [
  {
    heading: '1. DEFINITIONS',
    body:
      '1.1 "I", "me" and "my" refer to the Purchaser; and "you", "they" and "Company" refers to Lumina Auto which is the Seller and "us" or "we" refers to Company and me. 1.2 "Offer" means this offer to purchase that I have made to the Company. Once accepted, it becomes a binding contract. 1.3 "Risk" refers to the possibility of suffering harm or loss.',
  },
  {
    heading: '2. GENERAL CONDITIONS',
    body:
      '2.1 You will not be obliged to deliver the vehicle until a manager accepts the offer in writing. 2.2 If accepted, I will be liable to pay the balance of the purchase price. Risk passes to me on delivery. You continue to own the vehicle until paid in full. 2.3 The offer lapses if I cannot provide proof of ability to pay or finance approval within 14 days.',
  },
  {
    heading: '3. DELIVERY',
    body:
      '3.1 Delivery will be made at the agreed date/time at Lumina Auto premises. 3.3 Prior to taking delivery I have the right to examine the vehicle for quality.',
  },
  {
    heading: '4. WARRANTY / PLANS',
    body:
      "4.1 Sale is subject to manufacturer's warranty/plans if applicable. 4.5 Warranty may be void if terms are not complied with.",
  },
  {
    heading: '5. ORDERING FEE',
    body:
      'If I paid an ordering fee, it will be deducted from the balance. If I breach, I remain liable for amounts due and Lumina Auto may deduct a reasonable cancellation charge.',
  },
  {
    heading: '6. TRADE-INS',
    body:
      '6.1 I warrant the trade-in is my sole property, not subject to retention, all defects/modifications disclosed, and no accident damage exceeding R20,000. 6.4 Lumina Auto may reduce the value if the condition differs from the valuation.',
  },
  {
    heading: '7. HAZARDOUS NATURE',
    body: 'I am aware a motor vehicle can be dangerous if used contrary to instructions.',
  },
  {
    heading: '8. FIT FOR PURPOSE',
    body: '8.2 I have read the specifications and confirm the vehicle fits my purpose.',
  },
  {
    heading: '9. RETURN',
    body:
      '9.1 If I cancel and return the vehicle, I must pay the difference between my purchase price and the resale price, plus restocking costs.',
  },
  {
    heading: '10. MISCELLANEOUS',
    body:
      '10.1 Disputes will be addressed amicably within 10 days, failing which it may be referred to the motor ombudsman. 10.2 No variation is valid unless in writing.',
  },
  {
    heading: '11. PRE-OWNED SPECIFICATIONS',
    body:
      '11.4 I accept Lumina Auto believes the registration date and odometer are correct but cannot warrant this. 11.6 I accept the vehicle in its current condition with disclosed defects.',
  },
  {
    heading: '12. NEW VEHICLE SPECIFICATIONS',
    body: 'I confirm I am satisfied the vehicle is suited for my purpose based on promotional material.',
  },
  {
    heading: '13. SPECIAL CONDITIONS (NEW)',
    body:
      '13.1 List price at delivery may be higher than this offer. 13.2 The vehicle is new even if driven for delivery/testing.',
  },
  {
    heading: '14. POPIA & DATA PROTECTION',
    body:
      '14.1 Lumina Auto processes my personal information as a Responsible Party. 14.2 Information is not sold to third parties but may be shared with agents/banks for processing. 14.3 I have the right to access, correct, or withdraw consent. 15. I consent to Lumina Auto sharing my information strictly for reporting to authorities, eNatis registration, and rendering requested financial services.',
  },
];

export const generateOTP = (data: OTPData) => {
  const doc = new jsPDF();
  const primary: [number, number, number] = [212, 175, 55];
  const text: [number, number, number] = [26, 26, 26];
  const muted: [number, number, number] = [102, 102, 102];

  const leftMargin = 15;
  const rightMargin = 195;
  const pageWidth = 180;
  let y = 14;

  // HEADER — compact
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('MAKHULU HOLDINGS (PTY) LTD', leftMargin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...primary);
  doc.text('t/a Lumina Auto', leftMargin, y + 5);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text('Pretoria, South Africa  •  info@luminaauto.co.za  •  068 601 7462', leftMargin, y + 10);

  y += 14;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.6);
  doc.line(leftMargin, y, rightMargin, y);
  y += 5;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('OFFER TO PURCHASE', 105, y, { align: 'center' });
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, rightMargin, y);

  // Quote ref / date
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Quote Ref: ${data.quoteRef}`, leftMargin, y);
  doc.text(`Date: ${data.date}`, rightMargin, y, { align: 'right' });
  y += 3;

  const compactHead = { fillColor: [30, 30, 30] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9, cellPadding: 1.4 };
  const compactBody = { fontSize: 8.5, textColor: text, cellPadding: 1.2 };

  // SECTION 1: CLIENT
  autoTable(doc, {
    startY: y,
    head: [['CLIENT DETAILS', '']],
    body: [
      ['Full Name', data.clientName],
      ['ID Number', data.idNumber],
      ['Address', data.address],
      ['Email', data.email],
      ['Cell', data.cellPhone],
      ['Sales Executive', data.salesExecutive],
    ],
    margin: { left: leftMargin },
    tableWidth: pageWidth,
    theme: 'grid',
    headStyles: compactHead,
    bodyStyles: compactBody,
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // SECTION 2: VEHICLE
  autoTable(doc, {
    startY: y,
    head: [['VEHICLE DETAILS', '']],
    body: [
      ['Make', data.make],
      ['Model', data.model],
      ['Year', data.year],
      ['Reg No', data.regNo],
      ['Colour', data.colorVal],
      ['VIN No', data.vin],
      ['Engine No', data.engineNo],
      ['Mileage', data.mileage],
    ],
    margin: { left: leftMargin },
    tableWidth: pageWidth,
    theme: 'grid',
    headStyles: compactHead,
    bodyStyles: compactBody,
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // SECTION 3: FINANCIAL — all inputs are VAT-inclusive
  const total = data.basePrice + data.extrasPrice + data.vapPrice + data.adminFee;
  const vat = total * (15 / 115);
  const excl = total - vat;

  autoTable(doc, {
    startY: y,
    head: [['FINANCIAL SUMMARY (VAT inclusive)', 'Amount']],
    body: [
      ['Base Vehicle Price (incl. VAT)', fmt(data.basePrice)],
      ['Extras (incl. VAT)', fmt(data.extrasPrice)],
      ['Value Added Products (incl. VAT)', fmt(data.vapPrice)],
      ['Administration Fee (incl. VAT)', fmt(data.adminFee)],
      [{ content: 'Subtotal (excl. VAT)', styles: { fontStyle: 'bold' } }, { content: fmt(excl), styles: { fontStyle: 'bold', halign: 'right' } }],
      ['VAT (15%)', { content: fmt(vat), styles: { halign: 'right' } }],
      [
        { content: 'TOTAL BALANCE PAYABLE (incl. VAT)', styles: { fontStyle: 'bold', fillColor: [240, 230, 195] } },
        { content: fmt(total), styles: { fontStyle: 'bold', fillColor: [240, 230, 195], halign: 'right' } },
      ],
    ],
    margin: { left: leftMargin },
    tableWidth: pageWidth,
    theme: 'grid',
    headStyles: compactHead,
    bodyStyles: compactBody,
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 70, halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 7;

  // SIGNATURES — anchored directly under totals on page 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('SIGNATURES', leftMargin, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...text);
  doc.text(`Signed at ${data.signedPlace} on ${data.date}`, leftMargin, y);
  y += 11;
  doc.setDrawColor(...muted);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, leftMargin + 75, y);
  doc.line(110, y, 110 + 75, y);
  y += 3.5;
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text('Client Signature', leftMargin, y);
  doc.text('Sales Executive Signature', 110, y);

  // ============ PAGE 2: TERMS ============
  doc.addPage();
  y = 18;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('CONDITIONS OF OFFER — ALL VEHICLE SALES', 105, y, { align: 'center' });
  y += 2;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, y, rightMargin, y);
  y += 5;

  // Two-column layout
  const COL_GAP = 6;
  const COL_WIDTH = (pageWidth - COL_GAP) / 2;
  const COL_LEFT_X = leftMargin;
  const COL_RIGHT_X = leftMargin + COL_WIDTH + COL_GAP;
  const COL_TOP = y;
  const COL_BOTTOM = 282;
  const LINE_HEIGHT = 3.0;
  const HEADING_GAP = 3.4;
  const SECTION_GAP = 2.6;

  let col: 0 | 1 = 0;
  let colX = COL_LEFT_X;
  let colY = COL_TOP;

  const newColumnOrPage = () => {
    if (col === 0) {
      col = 1;
      colX = COL_RIGHT_X;
      colY = COL_TOP;
    } else {
      doc.addPage();
      col = 0;
      colX = COL_LEFT_X;
      colY = 18;
    }
  };

  const writeHeading = (heading: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primary);
    doc.text(heading, colX, colY);
    colY += HEADING_GAP;
  };

  const writeBodyLines = (lines: string[]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...text);
    for (const line of lines) {
      if (colY > COL_BOTTOM) newColumnOrPage();
      doc.text(line, colX, colY, { maxWidth: COL_WIDTH });
      colY += LINE_HEIGHT;
    }
  };

  const measureBody = (body: string): string[] => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    return doc.splitTextToSize(body, COL_WIDTH);
  };

  OTP_TERMS.forEach((section) => {
    const lines = measureBody(section.body);
    const keepTogether = HEADING_GAP + Math.min(2, lines.length) * LINE_HEIGHT;
    if (colY + keepTogether > COL_BOTTOM) newColumnOrPage();
    writeHeading(section.heading);
    writeBodyLines(lines);
    colY += SECTION_GAP;
  });

  // Acknowledgement — append inline, no forced page break
  const ackLines = (() => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    return doc.splitTextToSize(
      'I confirm I have read, understood and agree to be bound by the Conditions of Offer set out above and consent to the processing of my personal information in accordance with POPIA.',
      COL_WIDTH,
    );
  })();
  const ackBlockHeight = HEADING_GAP + ackLines.length * LINE_HEIGHT + 14;
  if (colY + ackBlockHeight > COL_BOTTOM) newColumnOrPage();

  colY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...text);
  doc.text('ACKNOWLEDGEMENT', colX, colY);
  colY += HEADING_GAP;
  writeBodyLines(ackLines);
  colY += 6;
  doc.setDrawColor(...muted);
  doc.setLineWidth(0.3);
  doc.line(colX, colY, colX + COL_WIDTH, colY);
  colY += 3;
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text('Purchaser Signature & Date', colX, colY);

  // Footer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text(`Lumina Auto  •  Offer to Purchase  •  ${data.quoteRef}`, 105, 292, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, rightMargin, 292, { align: 'right' });
  }

  doc.save(`OTP_${data.clientName.replace(/\s+/g, '_')}_${data.quoteRef}.pdf`);
};
