import type { QuoteData, QuoteLineItem } from './types';

/**
 * Result of the quote financial calculation. All money fields are numbers; the
 * document formats them. VAT behaviour is entirely driven by `vat_registered`.
 *
 * Total = retail_price + accessories_total + vaps_total.
 * When registered, VAT @ 15% is shown as a split of that total (VAT-inclusive
 * pricing, matching the OTP convention): subtotal_excl = total / 1.15.
 */
export interface QuoteCalc {
  accessoriesTotal: number;
  vapsTotal: number;
  total: number; // grand total due
  vatRegistered: boolean;
  /** Only meaningful when vatRegistered === true. */
  subtotalExcl: number | null;
  vat: number | null;
}

const sum = (items: QuoteLineItem[] | undefined): number =>
  (items || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

export const calcQuote = (
  data: Pick<QuoteData, 'accessories' | 'vaps' | 'retail_price' | 'vat_registered'>,
): QuoteCalc => {
  const accessoriesTotal = sum(data.accessories);
  const vapsTotal = sum(data.vaps);
  const total = (Number(data.retail_price) || 0) + accessoriesTotal + vapsTotal;

  if (!data.vat_registered) {
    return {
      accessoriesTotal,
      vapsTotal,
      total,
      vatRegistered: false,
      subtotalExcl: null,
      vat: null,
    };
  }

  // Registered: VAT @ 15% shown as an inclusive split of the grand total.
  const subtotalExcl = total / 1.15;
  const vat = total - subtotalExcl;
  return {
    accessoriesTotal,
    vapsTotal,
    total,
    vatRegistered: true,
    subtotalExcl,
    vat,
  };
};
