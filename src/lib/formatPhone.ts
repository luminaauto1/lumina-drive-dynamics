/**
 * Normalize a South African phone number for PDF rendering.
 *
 * Accepts inputs like:
 *   "+27 68 008 1793", "+27680081793", "0680081793", "068-008-1793"
 * Returns:
 *   "068 008 1793"
 *
 * Rules:
 *  - Strip every non-digit character (the leading "+" is consumed but recognised).
 *  - If the digits start with "27" and the original had a "+" or 11 digits, swap "27" for "0".
 *  - Group as XXX XXX XXXX.
 *  - If the input cannot be confidently parsed to 10 digits, return the trimmed original
 *    so we never lose information on the PDF.
 */
export const formatSAPhoneForPDF = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  // Convert international ZA prefix to local
  if ((hasPlus || digits.length === 11) && digits.startsWith('27')) {
    digits = '0' + digits.slice(2);
  }

  // Final shape must be 10 digits starting with 0
  if (digits.length !== 10) {
    return trimmed; // fall back to original — better than mangling
  }

  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};
