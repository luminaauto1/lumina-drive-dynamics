// Small formatting helpers for the Pipeline v2 table/drawer (SA-localised).
import { format, formatDistanceToNow } from 'date-fns';

export const formatCurrencyR = (n: number | null | undefined): string =>
  n == null ? '—' : `R ${Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;

export const formatPhone = (p: string | null | undefined): string => {
  if (!p) return '—';
  const d = String(p).replace(/\D/g, '');
  if (d.startsWith('27') && d.length === 11) return `0${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return p;
};

/**
 * SA international display/copy format: "+27 71 619 6071".
 * Accepts local (0XX XXX XXXX), intl (27XXXXXXXXX / +27...), or bare 9-digit
 * subscriber numbers. Falls back to the existing formatPhone()/raw when the
 * number isn't a recognisable SA mobile.
 */
export const formatPhoneIntl = (p: string | null | undefined): string => {
  if (!p) return '—';
  const d = String(p).replace(/\D/g, '');
  let sub = '';
  if (d.startsWith('27') && d.length === 11) sub = d.slice(2);
  else if (d.startsWith('0') && d.length === 10) sub = d.slice(1);
  else if (d.length === 9) sub = d;
  if (sub.length === 9) return `+27 ${sub.slice(0, 2)} ${sub.slice(2, 5)} ${sub.slice(5)}`;
  return formatPhone(p); // graceful fallback for non-SA / malformed
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'dd MMM yyyy');
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'HH:mm');
};

export const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
};

// ── Pipeline time-in-status timer ──────────────────────────────────────────
// Compact elapsed-time label + colour bucket for the Pipeline 'timer' column.
// Real wall-clock (24/7) per owner rule 2026-07-23.

/** Compact duration: "8m", "3h", "3h 20m", "2d 4h". Never shows seconds. */
export const formatDuration = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const totalHr = Math.floor(totalMin / 60);
  const minRem = totalMin % 60;
  if (totalHr < 24) return minRem ? `${totalHr}h ${minRem}m` : `${totalHr}h`;
  const days = Math.floor(totalHr / 24);
  const hrRem = totalHr % 24;
  return hrRem ? `${days}d ${hrRem}h` : `${days}d`;
};

export type TimerBucket = 'green' | 'amber' | 'red';

/** Age → colour bucket (owner thresholds 2026-07-23): 0–5h green, 5–14h amber,
 *  14h+ red. Boundaries land in the LOWER bucket (exactly 5h is still green). */
export const timerBucket = (ms: number): TimerBucket => {
  const hours = ms / 3_600_000;
  if (hours <= 5) return 'green';
  if (hours <= 14) return 'amber';
  return 'red';
};

/** Badge classes per bucket. Mirrors the existing credit-check badge tokens, so
 *  it renders correctly in both admin themes (light + dark). */
export const TIMER_BUCKET_CLASS: Record<TimerBucket, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
};
