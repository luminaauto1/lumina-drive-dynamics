// Quote formatters. NOTE: the quote document uses a DOT decimal separator
// ("R 489 900.00") and "07 Jul 2026" dates — deliberately different from the
// OTP helpers (comma decimal, YYYY/MM/DD), so they are defined fresh here.

/** South African currency, quote style: "R 489 900.00" (space thousands, dot decimal). */
export const fmtR = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  const s = Math.abs(v)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '-' : ''}R ${s}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a Date as "07 Jul 2026". Accepts a Date or undefined (=> today). */
export const fmtDate = (d?: Date): string => {
  const date = d ?? new Date();
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** Add `days` to `from` (default today) and format "14 Jul 2026" — for a quote's "valid until". */
export const addDaysDate = (days: number, from?: Date): string => {
  const base = from ? new Date(from) : new Date();
  base.setDate(base.getDate() + (Number.isFinite(days) ? days : 0));
  return fmtDate(base);
};

/** "—" for empty optional fields; never "undefined". */
export const orDash = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s === '' ? '—' : s;
};
