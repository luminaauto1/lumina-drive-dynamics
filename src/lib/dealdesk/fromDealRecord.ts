// Adapter: a joined deal_records row (the AccountingVATTab read shape) -> the
// ZTC-style `Deal` the ported Deal Desk components expect. Display-only logic;
// it never writes anything. gross_profit is read through dealNetProfit (canonical).

import type { Deal, DealStatus, DealStage, DealCondition } from './types';
import { toSastDateString } from './format';
import { dealNetProfit } from '@/lib/dealMetrics';

const num = (v: any): number | null => (v == null || v === '' ? null : Number(v));

/** Derive ZTC's lifecycle from Lumina fields (display-only). Returns one of the 5 literals. */
export function deriveDealStatus(row: any): DealStatus {
  if (row?.natis_sent_at) return 'cleared';
  if (row?.delivery_date) return 'delivered';
  if (row?.sale_date || row?.application?.is_invoiced) return 'invoiced';
  return 'contract_signed';
}

const DEAL_STAGE_VALUES: DealStage[] = ['none', 'deal_started', 'contract_signed', 'in_delivery', 'delivered', 'cleared'];

/** Deal-stage track: use the stored `deal_stage` column if present/valid, else map
 *  from the derived deal_status so the second badge always renders something sane. */
export function deriveDealStage(row: any): DealStage {
  const stored = row?.deal_stage;
  if (typeof stored === 'string' && DEAL_STAGE_VALUES.includes(stored as DealStage)) return stored as DealStage;
  switch (deriveDealStatus(row)) {
    case 'cleared': return 'cleared';
    case 'delivered': return 'delivered';
    case 'invoiced': return 'in_delivery';
    case 'contract_signed': return 'contract_signed';
    default: return 'deal_started';
  }
}

export function fromDealRecord(row: any): Deal {
  const app = row?.application || {};
  const v = row?.vehicle || {};
  const clientName =
    app.full_name ||
    [app.first_name, app.last_name].filter(Boolean).join(' ').trim() ||
    null;
  const makeModel = [v.make, v.model, v.variant].filter(Boolean).join(' ') || null;
  const cond = (v.condition as DealCondition) ?? null;

  return {
    id: row.id,
    application_id: row.application_id ?? null,
    vehicle_id: row.vehicle_id ?? null,
    client_name: clientName,
    client_id_number: app.id_number ?? null,
    client_phone: app.phone ?? null,
    client_email: app.email ?? null,
    vehicle_make_model: makeModel,
    vehicle_year: v.year != null ? String(v.year) : null,
    vehicle_vin: v.vin ?? null,
    vehicle_stock_no: v.stock_number ?? null,
    condition: cond,
    gross_profit: dealNetProfit(row),
    sold_price: num(row.sold_price),
    cost_price: num(row.cost_price),
    recon_cost: num(row.recon_cost),
    deal_status: deriveDealStatus(row),
    deal_stage: deriveDealStage(row),
    finance_status: app.status ?? null,
    sale_date: row.sale_date ?? null,
    delivery_date: toSastDateString(row.delivery_date),
    delivery_date_raw: row.delivery_date ?? null,
    natis_sent: !!row.natis_sent_at,
    natis_sent_at: row.natis_sent_at ?? null,
    natis_window_days: row.natis_window_days ?? null,
    is_closed: !!row.is_closed,
    notes: row.post_deal_notes ?? null,
    created_at: row.created_at,
  };
}

/** The select() projection the Deal Desk read hooks use (mirrors AccountingVATTab's join). */
export const DEAL_DESK_SELECT = `
  id, application_id, vehicle_id, sale_date, sold_price, cost_price, gross_profit,
  recon_cost, dic_amount, addons_data, aftersales_expenses, delivery_date, is_closed,
  post_deal_notes, natis_sent_at, natis_window_days, deal_stage, created_at,
  vehicle:vehicles(make, model, variant, year, vin, stock_number),
  application:finance_applications(first_name, last_name, full_name, id_number, phone, email, status)
`;
