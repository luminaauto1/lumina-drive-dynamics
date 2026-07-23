export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

export const formatMileage = (mileage: number): string => {
  return new Intl.NumberFormat('en-ZA').format(mileage) + ' km';
};

export const calculateMonthlyPayment = (
  price: number,
  interestRate: number = 13,
  termMonths: number = 72,
  depositPercent: number = 0
): number => {
  const deposit = price * (depositPercent / 100);
  const principal = price - deposit;
  const monthlyRate = interestRate / 100 / 12;

  if (monthlyRate === 0) {
    return principal / termMonths;
  }

  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return Math.round(payment);
};

/**
 * Monthly payment with a PROPER balloon, matching how a bank quotes it — used by
 * the public VehicleCard estimate (owner 2026-07-23).
 *
 * Deposit and balloon are NOT the same lever:
 *   • deposit  → paid upfront, removed from the financed amount, never accrues interest.
 *   • balloon  → a lump sum deferred to the END of the term. The full (post-deposit)
 *                amount is still financed and accrues interest for the whole term;
 *                only the balloon's CAPITAL is deferred. So a balloon raises the
 *                monthly vs treating the same % as a deposit.
 *
 * Formula: finance P = price − deposit, with a future balloon B due at month n.
 *   payment = (P − B·(1+r)^-n) · r / (1 − (1+r)^-n)
 * The B·(1+r)^-n term is the present value of the balloon — the slice of capital
 * you are NOT amortising over the term — while interest is still charged on all of P.
 */
export const calculateMonthlyPaymentWithBalloon = (
  price: number,
  interestRate: number,
  termMonths: number,
  depositPercent: number = 0,
  balloonPercent: number = 0,
): number => {
  const deposit = price * (Math.max(0, depositPercent) / 100);
  const financed = Math.max(0, price - deposit);
  const balloon = price * (Math.max(0, balloonPercent) / 100);
  const n = Math.max(1, Math.round(termMonths));
  const monthlyRate = interestRate / 100 / 12;

  if (monthlyRate <= 0) {
    // No interest: just amortise the non-balloon capital over the term.
    return Math.round(Math.max(0, financed - balloon) / n);
  }

  const discount = Math.pow(1 + monthlyRate, -n);
  const payment = ((financed - balloon * discount) * monthlyRate) / (1 - discount);
  return Math.round(Math.max(0, payment));
};

export const calculateMaxBalloon = (vehicleYear: number): number => {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleYear;
  return Math.max(0, 40 - vehicleAge * 5);
};
