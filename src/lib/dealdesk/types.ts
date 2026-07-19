// Deal Desk — shared types (ported from ZTC's lib/desk/types.ts, trimmed to what
// Lumina's additive layer uses). The cost-sheet / checklist / payee / event
// shapes mirror the new deal_* tables; the `Deal` shape is what fromDealRecord.ts
// produces from a joined deal_records row so the ported components type-check.

export type DealStatus = 'contract_signed' | 'invoiced' | 'delivered' | 'cleared' | 'cancelled';

/**
 * The stored back-office deal-stage track (deal_records.deal_stage column — see
 * 20260627100000_deal_records_deal_stage.sql). Runs in parallel to the finance
 * status track. `null` on a row means "derive on read" (fromDealRecord). 'none'
 * is the explicit blank/unset stage.
 */
export type DealStage = 'none' | 'deal_started' | 'contract_signed' | 'in_delivery' | 'delivered' | 'cleared';

export const DEAL_STAGE_OPTIONS: { value: DealStage; label: string }[] = [
  { value: 'none', label: 'No stage' },
  { value: 'deal_started', label: 'Deal started' },
  { value: 'contract_signed', label: 'Contract signed' },
  { value: 'in_delivery', label: 'In delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cleared', label: 'Cleared' },
];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  none: 'No stage',
  deal_started: 'Deal started',
  contract_signed: 'Contract signed',
  in_delivery: 'In delivery',
  delivered: 'Delivered',
  cleared: 'Cleared',
};
export type DealCondition = 'new' | 'used' | 'demo' | 'commercial';

/**
 * NATIS lifecycle step (deal_records.natis_stage). Tracks the registration
 * paperwork AFTER delivery, in parallel to the coarse deal_stage track:
 *   Delivered → ID & POR → Original Natis → Dealer stock → Blue File → Ready to send
 * `null` on a row = not started (UI defaults to 'delivered' once the deal is
 * delivered) or lifecycle complete (natis_sent_at set → stage cleared).
 */
export type NatisStage = 'delivered' | 'id_por' | 'original_natis' | 'dealer_stock' | 'blue_file' | 'ready_to_send';

/** Where the registration happens (deal_records.natis_location). */
export type NatisLocation = 'gauteng' | 'outside_gp';

export interface NatisStepDef {
  key: NatisStage;
  /** Short label shown under the stepper circle. */
  label: string;
  /** Forward-action button text used to advance INTO this step (e.g. 'Original Natis received'). */
  advanceLabel: string;
  /** Helper copy describing what to do while ON this step. */
  helper: string;
}

/** The 6 NATIS lifecycle steps, in order. */
export const NATIS_STEPS: NatisStepDef[] = [
  {
    key: 'delivered', label: 'Delivered', advanceLabel: 'Delivered',
    helper: 'Vehicle delivered. Collect the client’s ID and proof of residence to start the registration pack.',
  },
  {
    key: 'id_por', label: 'ID & POR', advanceLabel: 'ID & POR received',
    helper: 'ID and proof of residence are in hand. Waiting on the original NATIS document from the bank.',
  },
  {
    key: 'original_natis', label: 'Original Natis', advanceLabel: 'Original Natis received',
    helper: 'Original NATIS received. Register the vehicle into dealer stock.',
  },
  {
    key: 'dealer_stock', label: 'Dealer stock', advanceLabel: 'Dealer stock done',
    helper: 'Vehicle registered into dealer stock. Compile the blue file for registration.',
  },
  {
    key: 'blue_file', label: 'Blue File', advanceLabel: 'Blue file compiled',
    helper: 'Blue file compiled. Prepare the NATIS pack — mark it ready to send when everything is together.',
  },
  {
    key: 'ready_to_send', label: 'Ready to send', advanceLabel: 'Ready to send',
    helper: 'Everything is ready. Completing this step marks the NATIS as sent and clears the deal.',
  },
];

export const NATIS_STAGE_LABEL: Record<NatisStage, string> = {
  delivered: 'Delivered',
  id_por: 'ID & POR',
  original_natis: 'Original Natis',
  dealer_stock: 'Dealer stock',
  blue_file: 'Blue File',
  ready_to_send: 'Ready to send',
};

export const NATIS_LOCATION_LABEL: Record<NatisLocation, string> = {
  gauteng: 'In Gauteng (plates + disc)',
  outside_gp: 'Outside GP (send Natis only)',
};
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
  /** Stored back-office deal-stage track (deal_records.deal_stage); falls back to
   *  a value derived from deal_status when the column is null. */
  deal_stage: DealStage;
  /** Finance-track status of the linked application (finance_applications.status),
   *  for the parallel finance badge. Null when no application is joined. */
  finance_status: string | null;
  sale_date: string | null;
  delivery_date: string | null;     // SAST YYYY-MM-DD (coerced in the adapter)
  delivery_date_raw: string | null;  // original timestamptz, for display
  /** Financing bank (finance_applications.contract_bank_name — set by the Send Contract
   *  flow; the applicant's personal bank_name is deliberately NOT used here). */
  bank: string | null;
  /** Natis sent? Derived from deal_records.natis_sent_at != null. */
  natis_sent: boolean;
  natis_sent_at: string | null;
  natis_window_days: number | null;
  /** Stored NATIS lifecycle step (deal_records.natis_stage); null = not started / cleared. */
  natis_stage: NatisStage | null;
  natis_location: NatisLocation | null;
  natis_plates_disc_done: boolean;
  natis_whatsapp_on_done: boolean;
  /** Storage path of the uploaded NATIS doc in the documents bucket (deal/{id}/natis/...). */
  natis_doc_path: string | null;
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
