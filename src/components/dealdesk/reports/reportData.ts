// Deal Desk Reports — pure aggregation helpers (no React). Kept separate from
// ReportsView so the month/condition roll-ups and CSV shaping are trivially
// testable and the component stays presentational.

import type { Deal } from '@/lib/dealdesk/types';
import { monthKey } from '@/lib/dealdesk/format';

export interface MonthRow {
  key: string;   // YYYY-MM
  units: number;
  gp: number;    // ledger gross profit for the month
  avg: number;   // gp / units (0 when no units)
}

export interface ConditionRow {
  key: string;   // condition value or 'unspecified'
  label: string;
  units: number;
  gp: number;
  avg: number;
}

/** Bucket month for a deal — sale date, falling back to created (parity with DealsTable). */
export const dealMonthKey = (d: Deal): string => monthKey(d.sale_date || d.created_at);

/** Shift a `YYYY-MM` key by n months (n may be negative). */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = ((t % 12) + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Inclusive continuous sequence of month keys from..to (safety-capped). */
export function monthSeq(from: string, to: string): string[] {
  const out: string[] = [];
  let k = from;
  while (k <= to && out.length < 240) { out.push(k); k = addMonths(k, 1); }
  return out;
}

/** Compact axis label for a month key, e.g. `Jul 25`. */
export function formatMonthShort(key: string): string {
  const d = new Date(key + '-01T00:00:00Z');
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

/** Roll deals up into the given month keys (zero-filled for empty months). */
export function aggregateByMonth(deals: Deal[], keys: string[]): MonthRow[] {
  const m = new Map<string, { gp: number; units: number }>();
  for (const d of deals) {
    const k = dealMonthKey(d);
    if (!k) continue;
    const cur = m.get(k) || { gp: 0, units: 0 };
    cur.gp += Number(d.gross_profit) || 0;
    cur.units += 1;
    m.set(k, cur);
  }
  return keys.map((k) => {
    const v = m.get(k) || { gp: 0, units: 0 };
    return { key: k, units: v.units, gp: Math.round(v.gp), avg: v.units ? Math.round(v.gp / v.units) : 0 };
  });
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'New', used: 'Used', demo: 'Demo', commercial: 'Commercial', unspecified: 'Unspecified',
};
const CONDITION_ORDER = ['new', 'used', 'demo', 'commercial', 'unspecified'];

/** Units & GP grouped by vehicle condition; null condition folds into 'Unspecified'. */
export function aggregateByCondition(deals: Deal[]): ConditionRow[] {
  const m = new Map<string, { gp: number; units: number }>();
  for (const d of deals) {
    const k = d.condition || 'unspecified';
    const cur = m.get(k) || { gp: 0, units: 0 };
    cur.gp += Number(d.gross_profit) || 0;
    cur.units += 1;
    m.set(k, cur);
  }
  return CONDITION_ORDER
    .filter((k) => m.has(k))
    .map((k) => {
      const v = m.get(k)!;
      return { key: k, label: CONDITION_LABEL[k] || k, units: v.units, gp: Math.round(v.gp), avg: v.units ? Math.round(v.gp / v.units) : 0 };
    });
}
