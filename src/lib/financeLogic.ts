// Finance Logic - Bank Scoring Algorithm for Dynamic Interest Rates
import { calculateMonthlyPaymentWithBalloon } from '@/lib/formatters';

export interface VehicleRiskProfile {
  vehicleYear?: number;
  bodyType?: string;
  depositPercent: number;
}

export interface RateAdjustment {
  baseRate: number;
  agePenalty: number;
  typePenalty: number;
  depositBonus: number;
  finalRate: number;
}

/**
 * Calculate dynamic interest rate based on vehicle risk profile
 * Simulates bank scoring logic for interest rate adjustments
 */
export function calculateDynamicInterestRate(
  baseRate: number,
  riskProfile: VehicleRiskProfile
): RateAdjustment {
  const currentYear = new Date().getFullYear();
  let agePenalty = 0;
  let typePenalty = 0;
  let depositBonus = 0;

  // Age Penalty: If vehicle is older than 6 years, add +1.5% to rate
  if (riskProfile.vehicleYear) {
    const vehicleAge = currentYear - riskProfile.vehicleYear;
    if (vehicleAge > 6) {
      agePenalty = 1.5;
    }
  }

  // Type Penalty: If body type is 'Coupe' or 'Sport', add +0.5% to rate
  if (riskProfile.bodyType) {
    const riskyTypes = ['coupe', 'sport', 'sports', 'convertible'];
    if (riskyTypes.includes(riskProfile.bodyType.toLowerCase())) {
      typePenalty = 0.5;
    }
  }

  // Deposit Bonus: If deposit > 20%, subtract -1.0% from rate
  if (riskProfile.depositPercent > 20) {
    depositBonus = -1.0;
  }

  const finalRate = Math.max(0, baseRate + agePenalty + typePenalty + depositBonus);

  return {
    baseRate,
    agePenalty,
    typePenalty,
    depositBonus,
    finalRate,
  };
}

// Minimal shapes so this helper can be shared by the card and the inventory
// filter without importing the full hook types (avoids circular imports).
interface CardFinanceVehicle {
  price: number;
  finance_available?: boolean | null;
  status?: string | null;
  is_generic_listing?: boolean | null;
}

interface CardFinanceSettings {
  default_interest_rate?: number | null;
  // Public-card finance structure (owner-editable in Settings → Finance). One
  // structure for ALL vehicles; used verbatim, no teaser. See the migration
  // 20260723080000_public_card_finance_structure.sql.
  card_interest_rate?: number | null;   // NULL => fall back to default_interest_rate
  card_deposit_percent?: number | null;
  card_balloon_percent?: number | null;
  card_term_months?: number | null;
}

interface CardFinanceOffer {
  interest_rate_linked?: number | null;
  interest_rate_fixed?: number | null;
}

// Fallbacks used only when a settings row hasn't been saved yet (or a field is
// somehow null). These mirror the column DEFAULTs in the migration, so a fresh
// install and a saved-once install agree.
const CARD_FALLBACK = { rate: 13.75, deposit: 0, balloon: 0, term: 72 } as const;

/**
 * Single source of truth for the "/pm" figure shown on a VehicleCard.
 *
 * WYSIWYG (owner 2026-07-23): the estimate uses the four public-card values
 * EXACTLY as configured — interest rate, deposit %, balloon %, term — with no
 * hidden teaser. Balloon is a PROPER residual (see calculateMonthlyPaymentWithBalloon):
 * the full post-deposit amount is financed and accrues interest, only the balloon
 * capital is deferred, so a balloon raises the monthly rather than lowering it.
 *
 * One structure for every vehicle — in-stock and sourcing alike (the old
 * sourcing-only balloon-as-deposit branch is gone). A signed-in user with a real
 * bank offer still sees their personalised rate, applied over the same structure.
 *
 * Both the card and the inventory monthly-payment filter MUST call this so the
 * slider filters on the exact value the customer sees. Returns null when the
 * vehicle isn't financeable.
 */
export function getCardMonthlyPayment(
  vehicle: CardFinanceVehicle,
  siteSettings?: CardFinanceSettings | null,
  bestOffer?: CardFinanceOffer | null
): number | null {
  if (!vehicle.finance_available) return null;

  const hasPersonalizedRate =
    !!bestOffer && !!(bestOffer.interest_rate_linked || bestOffer.interest_rate_fixed);
  const personalizedRate = hasPersonalizedRate
    ? Math.min(bestOffer!.interest_rate_linked || 100, bestOffer!.interest_rate_fixed || 100)
    : undefined;

  // Rate precedence: a signed-in user's real bank offer > configured card rate >
  // the site default > the hard fallback. Deposit/balloon/term always come from
  // the card structure.
  const configuredRate =
    siteSettings?.card_interest_rate ??
    siteSettings?.default_interest_rate ??
    CARD_FALLBACK.rate;
  const rate = personalizedRate ?? configuredRate;

  const deposit = siteSettings?.card_deposit_percent ?? CARD_FALLBACK.deposit;
  const balloon = siteSettings?.card_balloon_percent ?? CARD_FALLBACK.balloon;
  const term = siteSettings?.card_term_months ?? CARD_FALLBACK.term;

  return calculateMonthlyPaymentWithBalloon(
    vehicle.price,
    rate,
    term,
    deposit,
    balloon,
  );
}
