/**
 * Deal Desk — Cost Sheet engine (ported verbatim from ZTC lib/desk/costsheet.ts).
 *
 *   Vehicle GP block:
 *     Sub Total  = Retail − Spotter − Delivery − oa
 *     Total GP   = Sub Total − Vehicle cost − Recon + C4C   (vehicle_gp)
 *     NOTE: "1% fleet" is shown but is NOT added into Total GP. (Quirk 1)
 *   Accessories line profit = Retail − Cost ; Accessories Total = Σ profit
 *   F&I line profit = profit_override ?? (Retail − Cost) ; F&I Total = Σ profit
 *   Total         = Vehicle GP + Accessories Total + F&I Total
 *   Correct Total = Total   (F&I no longer double-counted — fixed 2026-06-22)
 *
 * IMPORTANT (Lumina): this is an ANALYTICAL mirror. It is persisted only to the
 * deal_costsheet table and NEVER writes back to deal_records.gross_profit.
 */

import type { AccessoryLine, FniLine } from './types';

export interface CostSheetInput {
  retail: number;
  spotter: number;
  delivery: number;
  over_allowance: number;
  vehicle_cost: number;
  recon: number;
  fleet_1pct: number;
  c4c: number;
  accessories: AccessoryLine[];
  fni: FniLine[];
}

export interface CostSheetComputed {
  sub_total: number;
  vehicle_gp: number;
  accessories_total: number;
  fni_total: number;
  total: number;
  correct_total: number;
}

const r2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Profit on a single accessories line: Retail − Cost. */
export function accessoryProfit(line: Pick<AccessoryLine, 'retail' | 'cost'>): number {
  return r2((Number(line.retail) || 0) - (Number(line.cost) || 0));
}

/** Profit on a single F&I line: profit_override when set, else Retail − Cost. */
export function fniProfit(line: Pick<FniLine, 'retail' | 'cost' | 'profit_override'>): number {
  if (line.profit_override != null && (line.profit_override as unknown) !== '') {
    const o = Number(line.profit_override);
    if (Number.isFinite(o)) return r2(o);
  }
  return r2((Number(line.retail) || 0) - (Number(line.cost) || 0));
}

/** Compute every derived figure on the cost sheet. Pure. */
export function computeCostSheet(input: CostSheetInput): CostSheetComputed {
  const sub_total = r2(
    (input.retail || 0) - (input.spotter || 0) - (input.delivery || 0) - (input.over_allowance || 0),
  );
  // Quirk 1: fleet_1pct is intentionally NOT part of this sum. Recon is deducted here.
  const vehicle_gp = r2(sub_total - (input.vehicle_cost || 0) - (input.recon || 0) + (input.c4c || 0));

  const accessories_total = r2((input.accessories ?? []).reduce((sum, l) => sum + accessoryProfit(l), 0));
  const fni_total = r2((input.fni ?? []).reduce((sum, l) => sum + fniProfit(l), 0));

  const total = r2(vehicle_gp + accessories_total + fni_total);
  const correct_total = total; // F&I no longer double-counted (was total + fni_total)

  return { sub_total, vehicle_gp, accessories_total, fni_total, total, correct_total };
}

/** Default accessory rows (editable), in Excel order. */
export const DEFAULT_ACCESSORIES: AccessoryLine[] = [
  'Tyre', 'Maintenance plan/sp', 'Smash & Grab', 'Warranty', 'Windscreen Protection',
  'Paint protection', 'Tyre Sealant', 'Mags', 'Interior Protection', 'Headlight protection',
  'Dent', 'Leather', 'BlackRoof',
].map((detail) => ({ detail, supplier: '', retail: 0, cost: 0 }));

/** Default F&I rows (editable), in Excel order. */
export const DEFAULT_FNI: FniLine[] = [
  'On the road', 'Lic + Reg', 'Admin', 'DIC',
].map((detail) => ({ detail, retail: 0, cost: 0, profit_override: null }));

/** A fresh, blank cost-sheet input seeded with the default rows. */
export function blankCostSheetInput(): CostSheetInput {
  return {
    retail: 0, spotter: 0, delivery: 0, over_allowance: 0,
    vehicle_cost: 0, recon: 0, fleet_1pct: 0, c4c: 0,
    accessories: DEFAULT_ACCESSORIES.map((l) => ({ ...l })),
    fni: DEFAULT_FNI.map((l) => ({ ...l })),
  };
}
