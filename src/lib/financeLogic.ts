// Finance Logic - Bank Scoring Algorithm for Dynamic Interest Rates

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

/**
 * Marketing configuration for vehicle cards - more attractive teaser rates
 */
export interface MarketingRateConfig {
  term: number;
  rate: number;
}

export function getMarketingRateConfig(
  vehiclePrice: number,
  defaultSiteRate: number,
  hasPersonalizedRate: boolean,
  personalizedRate?: number
): MarketingRateConfig {
  // If user has personalized rate from bank offer, use that (no marketing logic)
  if (hasPersonalizedRate && personalizedRate !== undefined) {
    return {
      term: 72,
      rate: personalizedRate,
    };
  }

  // Marketing logic: Make cards look more attractive
  // Term: 96 months if price > R250k, else 72 months
  const term = vehiclePrice > 250000 ? 96 : 72;
  
  // Rate: 1% lower than default site setting (teaser rate)
  const rate = Math.max(0, defaultSiteRate - 1);

  return { term, rate };
}
