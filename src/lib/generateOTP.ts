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
      '1.1 "I", "me" and "my" refer to the Purchaser; and "you", "they" and "Company" refers to Lumina Auto which is the Seller and "us" or "we" refers to Company and me.\n' +
      '1.2 "Offer" means this offer to purchase that I have made to the Company. Once accepted, it becomes a binding contract.\n' +
      '1.3 "Risk" refers to the possibility of suffering harm or loss.',
  },
  {
    heading: '2. GENERAL CONDITIONS',
    body:
      '2.1 You will not be obliged to deliver the vehicle until a manager accepts the offer in writing.\n' +
      '2.2 If accepted, I will be liable to pay the balance of the purchase price. Risk passes to me on delivery. You continue to own the vehicle until paid in full.\n' +
      '2.3 The offer lapses if I cannot provide proof of ability to pay or finance approval within 14 days.',
  },
  {
    heading: '3. DELIVERY',
    body:
      '3.1 Delivery will be made at the agreed date/time at Lumina Auto premises.\n' +
      '3.3 Prior to taking delivery I have the right to examine the vehicle for quality.',
  },
  {
    heading: '4. WARRANTY / PLANS',
    body:
      '4.1 Sale is subject to manufacturer\'s warranty/plans if applicable.\n' +
      '4.5 Warranty may be void if terms are not complied with.',
  },
  {
    heading: '5. ORDERING FEE',
    body:
      'If I paid an ordering fee, it will be deducted from the balance. If I breach, I remain liable for amounts due and Lumina Auto may deduct a reasonable cancellation charge.',
  },
  {
    heading: '6. TRADE-INS',
    body:
      '6.1 I warrant the trade-in is my sole property, not subject to retention, all defects/modifications disclosed, and no accident damage exceeding R20,000.\n' +
      '6.4 Lumina Auto may reduce the value if the condition differs from the valuation.',
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
      '10.1 Disputes will be addressed amicably within 10 days, failing which it may be referred to the motor ombudsman.\n' +
      '10.2 No variation is valid unless in writing.',
  },
  {
    heading: '11. PRE-OWNED SPECIFICATIONS',
    body:
      '11.4 I accept Lumina Auto believes the registration date and odometer are correct but cannot warrant this.\n' +
      '11.6 I accept the vehicle in its current condition with disclosed defects.',
  },
  {
    heading: '12. NEW VEHICLE SPECIFICATIONS',
    body: 'I confirm I am satisfied the vehicle is suited for my purpose based on promotional material.',
  },
  {
    heading: '13. SPECIAL CONDITIONS (NEW)',
    body:
      '13.1 List price at delivery may be higher than this offer.\n' +
      '13.2 The vehicle is new even if driven for delivery/testing.',
  },
  {
    heading: '14. POPIA & DATA PROTECTION',
    body:
      '14.1 Lumina Auto processes my personal information as a Responsible Party.\n' +
      '14.2 Information is not sold to third parties but may be shared with agents/banks for processing.\n' +
      '14.3 I have the right to access, correct, or withdraw consent.\n' +
      '15. I consent to Lumina Auto sharing my information strictly for reporting to authorities, eNatis registration, and rendering requested financial services.',
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
  let y = 15;

  // HEADER
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('LUMINA AUTO', leftMargin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text('Pretoria, South Africa', leftMargin, y);
  y += 4;
  doc.text('Email: info@luminaauto.co.za  |  Cell: 068 601 7462', leftMargin, y);

  y += 8;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.8);
  doc.line(leftMargin, y, rightMargin, y);
  y += 8;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('OFFER TO PURCHASE', 105, y, { align: 'center' });
  y += 4;
  doc.setLineWidth(0.4);
  doc.line(leftMargin, y, rightMargin, y);

  // Quote ref / date strip
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text(`Quote Ref: ${data.quoteRef}`, leftMargin, y);
  doc.text(`Date: ${data.date}`, rightMargin, y, { align: 'right' });

  // SECTION 1: CLIENT
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['1. CLIENT DETAILS', '']],
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
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: text },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 120 } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // SECTION 2: VEHICLE
  autoTable(doc, {
    startY: y,
    head: [['2. VEHICLE DETAILS', '']],
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
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: text },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 120 } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // SECTION 3: FINANCIAL
  const subtotal = data.basePrice + data.extrasPrice + data.vapPrice + data.adminFee;
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  autoTable(doc, {
    startY: y,
    head: [['3. FINANCIAL SUMMARY', 'Amount']],
    body: [
      ['Base Vehicle Price', fmt(data.basePrice)],
      ['Extras', fmt(data.extrasPrice)],
      ['Value Added Products', fmt(data.vapPrice)],
      ['Administration Fee', fmt(data.adminFee)],
      [{ content: 'Vatable Subtotal', styles: { fontStyle: 'bold' } }, { content: fmt(subtotal), styles: { fontStyle: 'bold' } }],
      ['VAT (15%)', fmt(vat)],
      [
        { content: 'TOTAL BALANCE PAYABLE', styles: { fontStyle: 'bold', fillColor: [245, 235, 200] } },
        { content: fmt(total), styles: { fontStyle: 'bold', fillColor: [245, 235, 200], halign: 'right' } },
      ],
    ],
    margin: { left: leftMargin },
    tableWidth: pageWidth,
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: text },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 70, halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // SIGNATURES
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('SIGNATURES', leftMargin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...text);
  doc.text(`Signed at ${data.signedPlace} on ${data.date}`, leftMargin, y);
  y += 14;
  doc.setDrawColor(...muted);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, leftMargin + 75, y);
  doc.line(110, y, 110 + 75, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('Client Signature', leftMargin, y);
  doc.text('Sales Executive Signature', 110, y);

  // ============ PAGE 2+: TERMS ============
  doc.addPage();
  y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('CONDITIONS OF OFFER — ALL VEHICLE SALES', 105, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y, rightMargin, y);
  y += 8;

  const BOTTOM_LIMIT = 278; // reserve room for footer at y=292
  const TOP_MARGIN = 20;
  const LINE_HEIGHT = 3.4;
  const HEADING_GAP = 4.5;
  const SECTION_GAP = 4;

  OTP_TERMS.forEach((section) => {
    // Measure body using the SAME font that will render it (critical for accurate wrapping)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const bodyLines: string[] = doc.splitTextToSize(section.body, pageWidth);

    // Keep heading + at least 2 body lines together to avoid orphan headings
    const keepTogether = HEADING_GAP + Math.min(2, bodyLines.length) * LINE_HEIGHT;
    if (y + keepTogether > BOTTOM_LIMIT) {
      doc.addPage();
      y = TOP_MARGIN;
    }

    // Heading
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primary);
    doc.text(section.heading, leftMargin, y);
    y += HEADING_GAP;

    // Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...text);
    bodyLines.forEach((line: string) => {
      if (y > BOTTOM_LIMIT) { doc.addPage(); y = TOP_MARGIN; }
      doc.text(line, leftMargin, y);
      y += LINE_HEIGHT;
    });
    y += SECTION_GAP;
  });

  // Acknowledgement — reserve ~35mm for the full block + signature lines
  if (y + 35 > BOTTOM_LIMIT) { doc.addPage(); y = TOP_MARGIN; }
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...text);
  doc.text('ACKNOWLEDGEMENT', leftMargin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const ack = doc.splitTextToSize(
    'I confirm I have read, understood and agree to be bound by the Conditions of Offer set out above and consent to the processing of my personal information in accordance with POPIA.',
    pageWidth,
  );
  ack.forEach((line: string) => { doc.text(line, leftMargin, y); y += 3.2; });
  y += 10;
  doc.setDrawColor(...muted);
  doc.line(leftMargin, y, leftMargin + 75, y);
  doc.line(110, y, 110 + 75, y);
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('Purchaser Signature & Date', leftMargin, y);
  doc.text('Lumina Auto Representative', 110, y);

  // Footer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`Lumina Auto  •  Offer to Purchase  •  ${data.quoteRef}`, 105, 292, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, rightMargin, 292, { align: 'right' });
  }

  doc.save(`OTP_${data.clientName.replace(/\s+/g, '_')}_${data.quoteRef}.pdf`);
};
