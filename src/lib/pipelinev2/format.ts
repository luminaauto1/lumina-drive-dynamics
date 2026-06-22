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
