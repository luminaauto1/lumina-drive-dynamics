/**
 * Normalize a South African phone number for PDF rendering.
 *
 * Rules:
 *  - Strip every non-digit character.
 *  - Convert leading "+27" or "27" to "0".
 *  - Group as ^(\d{3})(\d{7})$ → "$1 $2" (e.g. "068 0081793").
 *  - If the input cannot be parsed to 10 digits, return the trimmed original.
 */
export const formatSAPhoneForPDF = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('27') && (trimmed.startsWith('+') || digits.length === 11)) {
    digits = '0' + digits.slice(2);
  }

  const match = digits.match(/^(\d{3})(\d{7})$/);
  return match ? `${match[1]} ${match[2]}` : trimmed;
};
