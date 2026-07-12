/**
 * South African ID number validation.
 *
 * A SA ID is 13 digits `YYMMDD GSSS C A Z`:
 *   1-6  = date of birth (YYMMDD)
 *   7-10 = gender sequence (0000-4999 female, 5000-9999 male)
 *   11   = citizenship (0 = SA citizen, 1 = permanent resident, 2 = refugee)
 *   12   = usually 8 or 9 (historical)
 *   13   = Luhn checksum over the first 12 digits
 *
 * A structurally-valid ID is exactly 13 digits, has a real date of birth, and passes
 * the Luhn check. This catches typos / malformed IDs — it does NOT confirm the person
 * exists at Home Affairs.
 *
 * The Luhn + DOB + gender logic mirrors `luhnValid` / `dobFromId` / `genderFromId`
 * in public/signio-fill.js, kept intentionally consistent (same century-pivot rule).
 */

export interface SaIdResult {
  valid: boolean;
  digits: string;
  length: boolean;
  dateValid: boolean;
  luhn: boolean;
  dob: string | null;
  gender: 'male' | 'female' | null;
  citizenship: 'citizen' | 'permanent_resident' | 'refugee' | 'other' | null;
  reason: string;
}

// Standard Luhn checksum over the full 13 digits (ported from `luhnValid`).
function luhnValid(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  let alt = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let d = +id[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Two-digit year → full year, pivoting on the current 2-digit year (as `dobFromId` does).
function fullYear(yy: number): number {
  const cur = new Date().getFullYear() % 100;
  return (yy <= cur ? 2000 : 1900) + yy;
}

// Parse YYMMDD into a real calendar date (validates month + day incl. leap years).
function parseDob(digits: string): { year: number; month: number; day: number } | null {
  if (digits.length < 6) return null;
  const yy = +digits.slice(0, 2);
  const mm = +digits.slice(2, 4);
  const dd = +digits.slice(4, 6);
  if (mm < 1 || mm > 12) return null;
  const year = fullYear(yy);
  // Day 0 of the next month resolves to the last day of `mm`, handling leap years.
  const daysInMonth = new Date(year, mm, 0).getDate();
  if (dd < 1 || dd > daysInMonth) return null;
  return { year, month: mm, day: dd };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Validate a raw SA ID string. Fully defensive: a MISSING id (null/undefined/blank)
 * returns `{ valid: false, reason: '' }` and is NOT treated as invalid — use
 * `isSaIdInvalid` to flag only a PRESENT-but-wrong id.
 */
export function validateSaId(raw: string | null | undefined): SaIdResult {
  const present = raw != null && String(raw).trim().length > 0;
  const digits = String(raw ?? '').replace(/\D/g, '');
  const length = digits.length === 13;

  const dob = length ? parseDob(digits) : null;
  const dateValid = !!dob;
  const luhn = length ? luhnValid(digits) : false;
  const valid = length && dateValid && luhn;

  const gender: SaIdResult['gender'] = length
    ? parseInt(digits.slice(6, 10), 10) >= 5000
      ? 'male'
      : 'female'
    : null;

  let citizenship: SaIdResult['citizenship'] = null;
  if (length) {
    const c = digits[10];
    citizenship =
      c === '0' ? 'citizen' : c === '1' ? 'permanent_resident' : c === '2' ? 'refugee' : 'other';
  }

  let reason = '';
  if (!present) reason = '';
  else if (valid) reason = 'Valid';
  else if (!length) reason = 'Must be 13 digits';
  else if (!dateValid) reason = 'Invalid date of birth';
  else reason = 'Checksum failed';

  return {
    valid,
    digits,
    length,
    dateValid,
    luhn,
    dob: dob ? `${dob.year}-${pad2(dob.month)}-${pad2(dob.day)}` : null,
    gender,
    citizenship,
    reason,
  };
}

/** True only when an id is actually present but fails validation (never flags a blank id). */
export function isSaIdInvalid(raw: string | null | undefined): boolean {
  const present = raw != null && String(raw).trim().length > 0;
  return present && !validateSaId(raw).valid;
}
