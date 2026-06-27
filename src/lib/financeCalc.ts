// Finance installment calculator — mirrors the Saker "Finance Quote" spreadsheet.
//
// The single source of truth for the monthly installment math used by the
// admin Quote Generator. Kept dependency-free so it can be unit-reasoned and
// reused. See AdminQuoteGenerator.tsx for the UI.

/**
 * Excel-compatible PMT. Returns the periodic payment for a loan.
 *
 * Call convention for a positive monthly payment:
 *   pmt(monthlyRate, term, -financed, residualAmount, begEnd)
 *
 * @param rate  periodic (monthly) interest rate, e.g. 0.135/12
 * @param nper  number of periods (months)
 * @param pv    present value (use a negative financed amount)
 * @param fv    future value / residual (balloon) amount, default 0
 * @param type  0 = payment at period END (arrears), 1 = BEGIN (advance)
 */
export function pmt(rate: number, nper: number, pv: number, fv = 0, type: 0 | 1 = 0): number {
  if (nper <= 0) return 0;
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  let payment = (rate / (pvif - 1)) * -(pv * pvif + fv);
  if (type === 1) payment /= 1 + rate;
  return payment;
}

/** Optional financed line item (rand amount added to the financed subtotal). */
export interface QuoteAddon {
  id: string;
  label: string;
  amount: number;
}

/** Optional monthly cover/insurance line item (rand per month). */
export interface QuoteCover {
  id: string;
  label: string;
  amount: number;
}

export interface FinanceQuoteInput {
  vehiclePrice: number;
  deposit: number;
  /** Annual interest rate as a percentage, e.g. 13.5 */
  annualRatePct: number;
  /** Term in months */
  term: number;
  /** Residual / balloon as a percentage of the VEHICLE PRICE, e.g. 35 */
  residualPct: number;
  /** Payment timing: 0 = END (arrears, default), 1 = BEG (advance) */
  begEnd: 0 | 1;
  /** Bank documentation fee, spread linearly over the term (not financed) */
  bankDocFee: number;
  /** Optional financed add-ons (Admin Fee, License & Reg, etc.) */
  addons?: QuoteAddon[];
  /** Optional monthly covers (Warranty, Trade Shield, etc.) */
  covers?: QuoteCover[];
}

export interface FinanceQuoteResult {
  /** vehiclePrice + financed add-ons */
  subtotal: number;
  /** subtotal − deposit (the amount financed) */
  financed: number;
  /** (residualPct / 100) × vehiclePrice */
  residualAmount: number;
  /** Excel PMT result (positive monthly payment) */
  payment: number;
  /** bankDocFee / term */
  bankDocFeeMonthly: number;
  /** payment + bankDocFeeMonthly */
  instalmentSubtotal: number;
  /** sum of monthly covers */
  coversTotal: number;
  /** instalmentSubtotal + coversTotal — the headline figure */
  totalPaymentPerMonth: number;
}

const sum = (rows?: { amount: number }[]) =>
  (rows ?? []).reduce((acc, r) => acc + (Number.isFinite(r.amount) ? r.amount : 0), 0);

/**
 * Compute a finance installment exactly as the Saker "Finance Quote" sheet does.
 *
 * Worked example (vehiclePrice 305000, no add-ons, deposit 0, rate 13.50%,
 * term 96, residual 0%, begEnd 0, bankDocFee 1207, warranty 69):
 *   payment ≈ 5211.89, bankDocFeeMonthly ≈ 12.57,
 *   instalmentSubtotal ≈ 5224.46, totalPaymentPerMonth ≈ 5293.46
 */
export function calcFinanceQuote(input: FinanceQuoteInput): FinanceQuoteResult {
  const {
    vehiclePrice,
    deposit,
    annualRatePct,
    term,
    residualPct,
    begEnd,
    bankDocFee,
  } = input;

  const addonsTotal = sum(input.addons);
  const subtotal = vehiclePrice + addonsTotal;
  const financed = subtotal - deposit;
  const residualAmount = (residualPct / 100) * vehiclePrice;
  const monthlyRate = annualRatePct / 100 / 12;

  const payment = pmt(monthlyRate, term, -financed, residualAmount, begEnd);
  const bankDocFeeMonthly = term > 0 ? bankDocFee / term : 0;
  const instalmentSubtotal = payment + bankDocFeeMonthly;
  const coversTotal = sum(input.covers);
  const totalPaymentPerMonth = instalmentSubtotal + coversTotal;

  return {
    subtotal,
    financed,
    residualAmount,
    payment,
    bankDocFeeMonthly,
    instalmentSubtotal,
    coversTotal,
    totalPaymentPerMonth,
  };
}

/** ZAR currency with configurable decimals (default 2). */
export function formatRand(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}
