// Single source of truth for the per-vehicle stock-in documents checklist.
// 4 required documents tracked per car brought into stock. Policy: WARN, not block.

export type StockDocKey = 'natis' | 'invoice' | 'inspection' | 'service_history';

export type StockDocStatus = 'missing' | 'uploaded' | 'not_needed';

export interface StockDocDef {
  key: StockDocKey;
  label: string;
  /** Short helper text shown under the label. */
  hint: string;
}

// Order here drives display order in the checklist.
export const STOCK_DOC_DEFS: StockDocDef[] = [
  { key: 'natis', label: 'NATIS copy', hint: 'Registration / title document' },
  { key: 'invoice', label: 'Purchase invoice', hint: 'Proof of purchase from the seller' },
  { key: 'inspection', label: 'Inspection / DEKRA + roadworthy', hint: 'Mechanical report & roadworthy certificate' },
  { key: 'service_history', label: 'Service history', hint: 'Service book or printout' },
];

export const STOCK_DOC_KEYS: StockDocKey[] = STOCK_DOC_DEFS.map((d) => d.key);

export const STOCK_DOC_LABELS: Record<StockDocKey, string> = STOCK_DOC_DEFS.reduce(
  (acc, d) => {
    acc[d.key] = d.label;
    return acc;
  },
  {} as Record<StockDocKey, string>,
);

export const STOCK_DOC_STATUS_LABELS: Record<StockDocStatus, string> = {
  missing: 'Missing',
  uploaded: 'Uploaded',
  not_needed: 'Not needed',
};

/** A doc slot counts as "outstanding" only when it is still missing. */
export const isOutstanding = (status: StockDocStatus) => status === 'missing';
