// Direct PDF download for the invoice preview — thin wrapper over the shared
// DOM→PDF renderer in lib/domToPdf (also used by the OTP Generator).
import { downloadPdfFromElement, pdfFilename } from '@/lib/domToPdf';

export const downloadInvoicePdf = downloadPdfFromElement;

export const invoiceFilename = (invoiceNumber: string, billToName: string): string =>
  pdfFilename('Invoice', invoiceNumber || 'draft', billToName || 'client');
