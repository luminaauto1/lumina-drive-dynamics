// Two-track status presentation config, shared by <StatusBadge> / <StatusSelect>.
//
// Lumina runs two parallel status tracks on a deal:
//   • 'finance' — the 9-step finance flow (finance_applications.status). Labels +
//     colours come from statusConfig and are admin-overridable via status_overrides
//     (merged at call sites through useStatusConfig).
//   • 'deal'    — the back-office deal lifecycle (deal_records.deal_stage). Labels +
//     colours come from the dealdesk deal-stage map.
//
// The two badges must be visually distinguishable WITHOUT relying on colour alone
// (accessibility): each track carries a leading icon + a distinct badge SHAPE
// (finance = pill / rounded-full; deal = tag / rounded-sm with a left notch dot).

import type { ComponentType } from 'react';
import { Banknote, Truck } from 'lucide-react';
import { STATUS_OPTIONS, STATUS_STYLES, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';
import { DEAL_STAGE_OPTIONS, DEAL_STAGE_LABEL, type DealStage } from '@/lib/dealdesk/types';

export type StatusTrack = 'finance' | 'deal';

const FALLBACK_CLASS = 'bg-muted text-muted-foreground border-border';

// Deal-stage colour classes (mirror dealdesk/badges DEAL_STATUS_CLASS tones,
// extended to the stored deal_stage values).
const DEAL_STAGE_CLASS: Record<string, string> = {
  none: 'bg-muted text-muted-foreground border-border',
  deal_started: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  contract_signed: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  in_delivery: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  delivered: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  cleared: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export interface TrackMeta {
  /** Leading icon — a non-colour signal that disambiguates the two tracks. */
  Icon: ComponentType<{ className?: string }>;
  /** Shape classes appended to the badge (distinct silhouette per track). */
  shapeClass: string;
  /** Options for a <StatusSelect> of this track (unfiltered; role filter applied separately). */
  options: { value: string; label: string }[];
}

export const TRACK_META: Record<StatusTrack, TrackMeta> = {
  // Finance = pill silhouette.
  finance: {
    Icon: Banknote,
    shapeClass: 'rounded-full',
    options: STATUS_OPTIONS,
  },
  // Deal = squared "tag" silhouette.
  deal: {
    Icon: Truck,
    shapeClass: 'rounded-sm',
    options: DEAL_STAGE_OPTIONS,
  },
};

/**
 * Map a finance-track status to its parallel deal-stage, for places that only have
 * the finance status in hand (e.g. the Deal Room) and want to show the second
 * badge. Returns null before the deal even starts so no deal badge is shown yet.
 */
export function financeStatusToDealStage(status: string | null | undefined): DealStage | null {
  switch (status) {
    case 'vehicle_delivered':
    case 'finalized':
      return 'cleared';
    case 'contract_signed':
      return 'in_delivery';
    case 'contract_sent':
    case 'validations_complete':
    case 'vehicle_selected':
      return 'contract_signed';
    case 'pre_approved':
    case 'documents_received':
    case 'validations_pending':
    case 'approved':
      return 'deal_started';
    default:
      return null;
  }
}

/** Effective label for a value on a track. Optional `overrides` (e.g. from
 *  useStatusConfig().labels) win for the finance track. */
export function trackLabel(
  track: StatusTrack,
  value: string | null | undefined,
  overrides?: Record<string, string>,
): string {
  if (!value) return '—';
  if (track === 'finance') {
    return overrides?.[value] || ADMIN_STATUS_LABELS[value] || value;
  }
  return DEAL_STAGE_LABEL[value as keyof typeof DEAL_STAGE_LABEL] || value;
}

/** Effective colour class for a value on a track. Optional `overrides` (e.g. from
 *  useStatusConfig().styles) win for the finance track. */
export function trackClass(
  track: StatusTrack,
  value: string | null | undefined,
  overrides?: Record<string, string>,
): string {
  if (!value) return FALLBACK_CLASS;
  if (track === 'finance') {
    return overrides?.[value] || STATUS_STYLES[value] || FALLBACK_CLASS;
  }
  return DEAL_STAGE_CLASS[value] || FALLBACK_CLASS;
}
