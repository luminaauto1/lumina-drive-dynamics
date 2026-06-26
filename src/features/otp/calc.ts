import type { OtpData, OtpFinancials, OtpLineToggles } from './types';

const NOT_REGISTERED_NOTE =
  'Makhulu Holdings (Pty) Ltd is not currently registered for VAT.';

/**
 * Result of the OTP financial calculation. All money fields are numbers; the
 * component formats them. VAT behaviour is entirely driven by `vat_registered`.
 *
 * Line-item VAT treatment:
 *   VATABLE     — base_price, extras, vap, admin_fee, delivery_fee
 *   NON-VATABLE — licensing (statutory disbursement, never carries VAT)
 */
export interface OtpCalc {
  vatableIncl: number;
  nonVatable: number;
  totalIncl: number;
  deposit: number;
  balance: number;
  vatRegistered: boolean;
  /** Only meaningful when vatRegistered === true. */
  subtotalExcl: number | null;
  vat: number | null;
  /** UI flags */
  novatTag: string; // "" when not registered; " (no VAT)" on the licensing line when registered
  vatNote: string; // grey note under the balance bar; "" when registered
}

/** Apply line toggles: a disabled line contributes 0 to the totals (and is hidden in the doc). */
const effective = (f: OtpFinancials, lines: OtpLineToggles) => ({
  base_price: f.base_price || 0,
  extras: lines.extras ? f.extras || 0 : 0,
  vap: lines.vap ? f.vap || 0 : 0,
  admin_fee: lines.admin_fee ? f.admin_fee || 0 : 0,
  delivery_fee: lines.delivery_fee ? f.delivery_fee || 0 : 0,
  licensing: lines.licensing ? f.licensing || 0 : 0,
  deposit: f.deposit || 0,
});

export const calcOtp = (data: Pick<OtpData, 'financials' | 'lines' | 'vat_registered'>): OtpCalc => {
  const f = effective(data.financials, data.lines);

  const vatableIncl = f.base_price + f.extras + f.vap + f.admin_fee + f.delivery_fee;
  const nonVatable = f.licensing;
  const totalIncl = vatableIncl + nonVatable;
  const balance = totalIncl - f.deposit;

  if (!data.vat_registered) {
    return {
      vatableIncl,
      nonVatable,
      totalIncl,
      deposit: f.deposit,
      balance,
      vatRegistered: false,
      subtotalExcl: null,
      vat: null,
      novatTag: '',
      vatNote: NOT_REGISTERED_NOTE,
    };
  }

  // Registered: VAT @ 15% on the vatable lines only; licensing stays excluded.
  const subtotalExcl = vatableIncl / 1.15;
  const vat = vatableIncl - subtotalExcl;
  return {
    vatableIncl,
    nonVatable,
    totalIncl,
    deposit: f.deposit,
    balance,
    vatRegistered: true,
    subtotalExcl,
    vat,
    novatTag: ' (no VAT)',
    vatNote: '',
  };
};
