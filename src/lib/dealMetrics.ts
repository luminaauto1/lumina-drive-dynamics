// Single source of truth for deal financial metrics so Analytics, Reports and
// Accounting all report the SAME numbers. Re-deriving profit on each page is how
// the figures drifted apart and double-counted DIC / referral income.

export interface DealLike {
  gross_profit?: number | null;
  dic_amount?: number | null;
  referral_income_amount?: number | null;
  sale_date?: string | null;
  is_closed?: boolean | null;
  created_at?: string | null;
}

/**
 * A deal counts toward financials once it has been finalized — i.e. it has a
 * sale date (set in the Finalize Deal modal) or is explicitly flagged closed.
 * Draft/incomplete deal_records (no sale_date) are excluded.
 */
export const isFinalizedDeal = (d: DealLike): boolean =>
  Boolean(d.sale_date) || d.is_closed === true;

/**
 * Net profit Lumina keeps from a deal, BEFORE sales-rep commission.
 *
 * This is exactly the value written to deal_records.gross_profit at finalize
 * time: (selling − discount) + VAP revenue + DIC + referral income
 *        − vehicle cost − recon − aftersales − dealer deposit − addon cost
 *        − referral commission − partner split.
 *
 * DIC and referral income are ALREADY included here, so never add them again.
 * Use the stored column directly — re-deriving from raw columns drifts because
 * it inevitably omits some of the inputs above.
 */
export const dealNetProfit = (d: DealLike): number => Number(d.gross_profit || 0);

/** The date a deal should be reported under: the sale date, else record creation. */
export const dealReportDate = (d: DealLike): string | null =>
  d.sale_date || d.created_at || null;

/**
 * The report date as a Date object, parsed in LOCAL time.
 * sale_date is stored as a date-only string (YYYY-MM-DD); `new Date('2026-06-10')`
 * would parse it as UTC midnight, shifting it to the previous day in SAST (UTC+2).
 */
export const dealReportDateObj = (d: DealLike): Date | null => {
  const raw = dealReportDate(d);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
  return new Date(raw);
};
