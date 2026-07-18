// One-click real-text OTP download. Callers lazy-import this module
// (`await import('@/features/otp/pdf/download')`) so @react-pdf/renderer and
// the WOFF fonts live in their own async chunk and never weigh down the app.
import { pdf } from '@react-pdf/renderer';
import type { OtpData } from '../types';
import { ensureOtpFonts } from './fonts';
import { OtpPdfDocument } from './OtpPdfDocument';

export async function downloadOtpPdf(data: OtpData, filename: string): Promise<void> {
  ensureOtpFonts();
  const blob = await pdf(<OtpPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
