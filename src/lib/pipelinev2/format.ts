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
