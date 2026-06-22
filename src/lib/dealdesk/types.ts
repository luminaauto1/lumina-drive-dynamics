// Deal Desk — shared types (ported from ZTC's lib/desk/types.ts, trimmed to what
// Lumina's additive layer uses). The cost-sheet / checklist / payee / event
// shapes mirror the new deal_* tables; the `Deal` shape is what fromDealRecord.ts
// produces from a joined deal_records row so the ported components type-check.

export type DealStatus = 'contract_signed' | 'invoiced' | 'delivered' | 'cleared' | 'cancelled';
export type DealCondition = 'new' | 'used' | 'demo' | 'commercial';
export type ChecklistStep = 'not_started' | 'requested' | 'in_progress' | 'done' | 'not_applicable';
export type PickupOrDelivery = 'pickup' | 'delivery';
export type PayeeType = 'spotter' | 'other';
export type ExpenseReason =
  | 'spotter' | 'disc_and_plates' | 'delivery' | 'advertising'
  | 'fitments' | 'fuel' | 'spare_key' | 'service' | 'other';

/** A sold-car deal — adapter view over a joined deal_records row (see fromDealRecord.ts). */
export interface Deal {
  id: string;
  application_id: string | null;
  vehicle_id: string | null;
  client_name: string | null;
  client_id_number: string | null;
  client_phone: string | null;
  client_email: string | null;
  vehicle_make_model: string | null;
  vehicle_year: string | null;
  vehicle_vin: string | null;
  vehicle_stock_no: string | null;
  condition: DealCondition | null;
  /** Canonical ledger profit (deal_records.gross_profit via dealNetProfit). */
  gross_profit: number;
  sold_price: number | null;
  cost_price: number | null;
  recon_cost: number | null;
  deal_status: DealStatus;
  sale_date: string | null;
  delivery_date: string | null;     // SAST YYYY-MM-DD (coerced in the adapter)
  delivery_date_raw: string | null;  // original timestamptz, for display
  /** Natis sent? Derived from deal_records.natis_sent_at != null. */
  natis_sent: boolean;
  natis_sent_at: string | null;
  natis_window_days: number | null;
  is_closed: boolean;
  notes: string | null;
  created_at: string;
}

export interface AccessoryLine {
  detail: string;
  supplier: string;
  retail: number;
  cost: number;
}

export interface FniLine {
  detail: string;
  retail: number;
  cost: number;
  profit_override: number | null;
}

export interface DealCosting {
  id: string;
  deal_id: string;
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
  vehicle_gp: number;
  accessories_total: number;
  fni_total: number;
  total: number;
  correct_total: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryChecklist {
  id: string;
  deal_id: string;
  pickup_or_delivery: PickupOrDelivery;
  fica: ChecklistStep;
  recon: ChecklistStep;
  dekra: ChecklistStep;
  point_80: ChecklistStep;
  fitments: ChecklistStep;
  valet: ChecklistStep;
  insurance: ChecklistStep;
  fuel_keys_permit: ChecklistStep;
  delivery_ready: boolean;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payee {
  id: string;
  name: string;
  type: PayeeType;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  deal_id: string | null;
  payee_id: string | null;
  expense_date: string | null;
  amount: number;
  reason: ExpenseReason;
  vin: string | null;
  paid: boolean;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealEvent {
  id: string;
  deal_id: string;
  actor_id: string | null;
  event_type: string;
  summary: string;
  changes: any | null;
  created_at: string;
}

export interface DeskSettings {
  id: string;
  natis_window_days: number;
  natis_warn_days: number;
  updated_at: string;
}

/* ---------- label maps ---------- */

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  contract_signed: 'Contract signed',
  invoiced: 'Invoiced',
  delivered: 'Delivered',
  cleared: 'Finalized',
  cancelled: 'Cancelled',
};

export const CONDITION_LABEL: Record<DealCondition, string> = {
  new: 'New', used: 'Used', demo: 'Demo', commercial: 'Commercial',
};

export const CHECKLIST_STEP_LABEL: Record<ChecklistStep, string> = {
  not_started: 'Not started',
  requested: 'Requested',
  in_progress: 'In progress',
  done: 'Done',
  not_applicable: 'N/A',
};

export const CHECKLIST_STEP_OPTIONS: ChecklistStep[] = ['not_started', 'requested', 'in_progress', 'done', 'not_applicable'];

/** The eight checklist step keys, in display order. */
export const CHECKLIST_STEPS: { key: keyof Pick<DeliveryChecklist,
  'fica' | 'recon' | 'dekra' | 'point_80' | 'fitments' | 'valet' | 'insurance' | 'fuel_keys_permit'>; label: string }[] = [
  { key: 'fica', label: 'FICA' },
  { key: 'recon', label: 'Recon' },
  { key: 'dekra', label: 'Dekra' },
  { key: 'point_80', label: '80-point' },
  { key: 'fitments', label: 'Fitments' },
  { key: 'valet', label: 'Valet' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'fuel_keys_permit', label: 'Fuel / keys / permit' },
];

export const EXPENSE_REASON_LABEL: Record<ExpenseReason, string> = {
  spotter: 'Spotter',
  disc_and_plates: 'Disc & plates',
  delivery: 'Delivery',
  advertising: 'Advertising',
  fitments: 'Fitments',
  fuel: 'Fuel',
  spare_key: 'Spare key',
  service: 'Service',
  other: 'Other',
};

export const EXPENSE_REASON_OPTIONS: ExpenseReason[] = [
  'spotter', 'disc_and_plates', 'delivery', 'advertising', 'fitments', 'fuel', 'spare_key', 'service', 'other',
];
