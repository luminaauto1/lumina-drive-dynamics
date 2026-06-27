// Deal Desk — guided stage flow model.
//
// The drawer drives a deal through its back-office lifecycle as a 5-step bar:
//
//   Contract signed → ① Stock the car → ② Finalize → ③ Delivery & NATIS → ④ Cleared
//
// This is a *presentation* layer over the stored `deal_records.deal_stage` column
// (see types.ts → DealStage) plus a little derived state (is the draft finalized?
// is the car delivered? was NATIS sent?). The numbered steps map onto the stored
// stage values so the bar and the badge stay in sync:
//
//   stored stage      → bar position
//   ----------------------------------------------------------------
//   deal_started      → before "Contract signed" (shown dim)
//   contract_signed   → "Contract signed" done; on ① Stock the car
//   in_delivery       → ② Finalize done; on ③ Delivery & NATIS
//   delivered         → car delivered; on ③ (awaiting NATIS) / ④
//   cleared           → ④ Cleared (done)
//
// Profit math is untouched: advancing the stage NEVER recomputes gross_profit.
// finance_applications.status is also untouched — the two tracks stay parallel.

import type { Deal, DealStage } from './types';
import { isAwaitingFinalize } from '@/components/dealdesk/isAwaitingFinalize';

export type StageStepKey = 'contract_signed' | 'stock' | 'finalize' | 'delivery' | 'cleared';

export interface StageStep {
  key: StageStepKey;
  /** Numbered label prefix for the three actionable middle steps (①②③④). */
  index: number | null;
  label: string;
}

/** The 5 steps in display order. "Contract signed" is the entry gate (no number). */
export const STAGE_STEPS: StageStep[] = [
  { key: 'contract_signed', index: null, label: 'Contract signed' },
  { key: 'stock',           index: 1,    label: 'Stock the car' },
  { key: 'finalize',        index: 2,    label: 'Finalize' },
  { key: 'delivery',        index: 3,    label: 'Delivery & NATIS' },
  { key: 'cleared',         index: 4,    label: 'Cleared' },
];

export type StepState = 'done' | 'current' | 'upcoming';

/** Zero-based index of the FIRST not-yet-complete step (the "current" step). */
export function currentStepIndex(deal: Deal): number {
  // Cleared: everything done.
  if (deal.deal_stage === 'cleared' || deal.natis_sent) return STAGE_STEPS.length - 1;
  // Delivered (but NATIS not yet sent): sitting on Delivery & NATIS.
  if (deal.deal_stage === 'delivered' || deal.delivery_date) return 3;
  // Finalized draft (has profit / sale date) but not yet delivered: on Delivery & NATIS.
  if (deal.deal_stage === 'in_delivery' || (!isAwaitingFinalize(deal) && deal.sale_date)) return 3;
  // Contract signed, not yet finalized → the deal is at the "① Stock the car" step
  // (so the bar marks Contract signed done and ① as current). The Stage panel
  // surfaces BOTH the stock-docs checklist (①) and the Finalize action (②) here,
  // so finalize stays reachable without falsely marking ① complete.
  if (deal.deal_stage === 'contract_signed' || isAwaitingFinalize(deal)) return 1;
  // deal_started / none / anything earlier: contract not yet signed → step 0.
  return 0;
}

export function stepState(deal: Deal, stepIdx: number): StepState {
  const current = currentStepIndex(deal);
  if (stepIdx < current) return 'done';
  if (stepIdx === current) return 'current';
  return 'upcoming';
}

/**
 * Compute the stage that a given deal *should* be advanced to after an action,
 * NEVER moving backwards. Returns null when no change is needed.
 *
 *   afterFinalize → at least 'in_delivery'
 *   afterDelivery → at least 'delivered'
 *   afterNatis    → 'cleared'
 */
const STAGE_RANK: Record<DealStage, number> = {
  none: 0, deal_started: 1, contract_signed: 2, in_delivery: 3, delivered: 4, cleared: 5,
};

export function nextStageAfter(current: DealStage, target: DealStage): DealStage | null {
  return STAGE_RANK[target] > STAGE_RANK[current] ? target : null;
}
