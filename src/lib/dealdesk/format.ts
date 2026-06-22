// Deal Desk — formatting helpers (ported verbatim from ZTC lib/desk/format.ts).
// Money is South African Rand displayed as `R 28 845.90`. Day math is SAST-pinned.

/** Format a number as Rand: `R 28 845.90`. Null/NaN -> `R 0.00`. */
export function formatRand(value: number | null | undefined): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const neg = safe < 0;
  const [whole, frac] = Math.abs(safe).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '-' : ''}R ${grouped}.${frac}`;
}

/** Compact Rand for KPI cards: `R 28.8k`, `R 1.2m`. Full value for < 1000. */
export function formatRandCompact(value: number | null | undefined): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(safe);
  if (abs >= 1_000_000) return `${safe < 0 ? '-' : ''}R ${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${safe < 0 ? '-' : ''}R ${(abs / 1_000).toFixed(1)}k`;
  return formatRand(safe);
}

/** Parse a money-ish string ("R 28 845,90", "28845.90") into a number. 0 on failure. */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  let s = String(input).trim().replace(/[Rr]\s?/g, '').replace(/\s/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Today's date in SAST (UTC+2) as a Date pinned to UTC midnight of that day. */
export function sastToday(now: Date = new Date()): Date {
  const sast = new Date(now.getTime() + 2 * 3600_000);
  return new Date(Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate()));
}

/** Coerce any ISO/timestamptz string to the SAST calendar date `YYYY-MM-DD`. */
export function toSastDateString(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sast = new Date(d.getTime() + 2 * 3600_000);
  return `${sast.getUTCFullYear()}-${String(sast.getUTCMonth() + 1).padStart(2, '0')}-${String(sast.getUTCDate()).padStart(2, '0')}`;
}

/** Whole days between an ISO date and a target Date (b - a), counting calendar days. */
export function daysBetween(aISO: string, bDate: Date): number {
  const a = new Date(aISO + (aISO.length <= 10 ? 'T00:00:00Z' : ''));
  const aMid = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  return Math.round((bDate.getTime() - aMid.getTime()) / 86_400_000);
}

/** Short human date, e.g. `14 Jun 2026`. Empty string for null. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00Z' : ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Short human date + time in SAST, e.g. `14 Jun 2026, 13:05`. Empty for null. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg',
  });
}

/** Month label, e.g. `June 2026`. */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00Z' : ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** `YYYY-MM` key for a date string (SAST). */
export function monthKey(iso: string | null | undefined): string {
  const s = toSastDateString(iso);
  return s ? s.slice(0, 7) : '';
}
