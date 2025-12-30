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
  depositPercent: number = 10
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

export const calculateMaxBalloon = (vehicleYear: number): number => {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleYear;
  return Math.max(0, 40 - vehicleAge * 5);
};
