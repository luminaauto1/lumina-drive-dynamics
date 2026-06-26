// One money formatter, used everywhere. South African format: "R 262 500,00"
// (space thousands separator, comma decimal).
export const fmtZAR = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  const s = Math.abs(v)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '-' : ''}R ${s}`;
};

/** Format a Date as YYYY/MM/DD (the OTP convention). Accepts a Date or undefined (=> today). */
export const fmtOtpDate = (d?: Date): string => {
  const date = d ?? new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

/** Add `days` to `from` (default today) and format YYYY/MM/DD — for offer "valid until". */
export const addDaysOtpDate = (days: number, from?: Date): string => {
  const base = from ? new Date(from) : new Date();
  base.setDate(base.getDate() + (Number.isFinite(days) ? days : 0));
  return fmtOtpDate(base);
};
