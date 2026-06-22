/**
 * Deal Desk — Natis countdown (ported from ZTC lib/desk/natis.ts).
 *
 *   days_since_delivery = today − delivery_date     (only while delivered)
 *   days_left           = natis_window_days − days_since_delivery
 *
 * Runs only when deal_status = 'delivered' AND natis not yet sent.
 * natis_sent (Lumina: natis_sent_at != null) => the deal is 'cleared'.
 * Colours: >10 green · 5–10 amber · 0–5 red · <0 red "EXPIRED".
 */

import type { Deal, DeskSettings } from './types';
import { daysBetween, sastToday } from './format';

export type NatisTone = 'green' | 'amber' | 'red' | 'expired' | 'cleared' | 'none';

export interface NatisStatus {
  active: boolean;
  daysSinceDelivery: number | null;
  daysLeft: number | null;
  tone: NatisTone;
  label: string;
  expired: boolean;
}

const DEFAULT_WINDOW = 21;
const DEFAULT_WARN = 5;

export function natisStatus(
  deal: Pick<Deal, 'deal_status' | 'delivery_date' | 'natis_sent' | 'natis_window_days'>,
  settings?: Pick<DeskSettings, 'natis_window_days' | 'natis_warn_days'> | null,
  today: Date = sastToday(),
): NatisStatus {
  const window = deal.natis_window_days ?? settings?.natis_window_days ?? DEFAULT_WINDOW;

  if (deal.natis_sent || deal.deal_status === 'cleared') {
    return { active: false, daysSinceDelivery: null, daysLeft: null, tone: 'cleared', label: 'Cleared', expired: false };
  }
  if (deal.deal_status !== 'delivered' || !deal.delivery_date) {
    return { active: false, daysSinceDelivery: null, daysLeft: null, tone: 'none', label: '—', expired: false };
  }

  const daysSinceDelivery = daysBetween(deal.delivery_date, today);
  const daysLeft = window - daysSinceDelivery;
  const tone = toneFor(daysLeft);
  const expired = daysLeft < 0;

  const label = expired
    ? `EXPIRED (${Math.abs(daysLeft)}d over)`
    : daysLeft === 0
      ? 'Due today'
      : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

  return { active: true, daysSinceDelivery, daysLeft, tone, label, expired };
}

/** Colour bucket for a days-left value: >10 green · 5–10 amber · 0–5 red · <0 expired. */
export function toneFor(daysLeft: number): NatisTone {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 5) return 'red';
  if (daysLeft <= 10) return 'amber';
  return 'green';
}

/** True when the deal is expiring soon (within warn window) or already expired. */
export function isNatisAttention(
  status: NatisStatus,
  settings?: Pick<DeskSettings, 'natis_warn_days'> | null,
): boolean {
  if (!status.active || status.daysLeft == null) return false;
  const warn = settings?.natis_warn_days ?? DEFAULT_WARN;
  return status.daysLeft <= warn;
}

/** Tailwind classes for a Natis chip, keyed by tone (re-skinned to Lumina shadcn tokens). */
export const NATIS_CHIP_CLASS: Record<NatisTone, string> = {
  green:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  amber:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  red:     'bg-red-500/15 text-red-400 border border-red-500/40',
  expired: 'bg-red-600 text-white border border-red-600',
  cleared: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  none:    'bg-muted text-muted-foreground border border-border',
};
