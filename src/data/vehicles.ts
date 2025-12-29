import { Vehicle } from '@/hooks/useWishlist';

export const vehicles: Vehicle[] = [
  {
    id: '1',
    make: 'BMW',
    model: 'M4',
    variant: 'Competition',
    year: 2022,
    mileage: 18500,
    price: 1450000,
    images: [
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&q=80',
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',
    ],
    transmission: 'Automatic',
    fuelType: 'Petrol',
    color: 'San Marino Blue',
    engineCode: 'S58B30',
    vin: 'WBAWD1324N5P12345',
    financeAvailable: true,
    status: 'available',
    serviceHistory: 'Full BMW Service History',
    description: 'Immaculate M4 Competition with M Performance exhaust and carbon fibre package.',
  },
  {
    id: '2',
    make: 'Mercedes-Benz',
    model: 'C63 S',
    variant: 'AMG Coupe',
    year: 2021,
    mileage: 24000,
    price: 1680000,
    images: [
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80',
      'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=800&q=80',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
    ],
    transmission: 'Automatic',
    fuelType: 'Petrol',
    color: 'Obsidian Black',
    engineCode: 'M177',
    financeAvailable: true,
    status: 'available',
    serviceHistory: 'Full Mercedes-Benz Service History',
    description: 'The ultimate AMG coupe with twin-turbo V8 power and luxurious interior.',
  },
  {
    id: '3',
    make: 'Porsche',
    model: '911',
    variant: 'Carrera S',
    year: 2023,
    mileage: 8200,
    price: 2450000,
    images: [
      'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
      'https://images.unsplash.com/photo-1611821064430-0d40291d0f0b?w=800&q=80',
    ],
    transmission: 'PDK',
    fuelType: 'Petrol',
    color: 'GT Silver',
    financeAvailable: true,
    status: 'available',
    serviceHistory: 'Porsche Approved',
    description: 'Nearly new 992 Carrera S with Sport Chrono and PASM suspension.',
  },
  {
    id: '4',
    make: 'Audi',
    model: 'RS6',
    variant: 'Avant',
    year: 2022,
    mileage: 32000,
    price: 1890000,
    images: [
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80',
      'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&q=80',
      'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80',
    ],
    transmission: 'Tiptronic',
    fuelType: 'Petrol',
    color: 'Nardo Grey',
    financeAvailable: true,
    status: 'available',
    serviceHistory: 'Full Audi Service History',
    description: 'The perfect blend of supercar performance and family practicality.',
  },
  {
    id: '5',
    make: 'Lamborghini',
    model: 'Huracán',
    variant: 'EVO RWD',
    year: 2021,
    mileage: 5200,
    price: 4950000,
    images: [
      'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=800&q=80',
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800&q=80',
      'https://images.unsplash.com/photo-1580414057403-c5f451f30e1c?w=800&q=80',
    ],
    transmission: 'Dual Clutch',
    fuelType: 'Petrol',
    color: 'Bianco Monocerus',
    financeAvailable: false,
    status: 'available',
    serviceHistory: 'Lamborghini Certified',
    description: 'Rear-wheel drive perfection. The purists choice.',
  },
  {
    id: '6',
    make: 'Ferrari',
    model: '488',
    variant: 'GTB',
    year: 2019,
    mileage: 12800,
    price: 4250000,
    images: [
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80',
      'https://images.unsplash.com/photo-1592198084033-aade902d1f19?w=800&q=80',
      'https://images.unsplash.com/photo-1568373274216-a8ef3a2ae6f0?w=800&q=80',
    ],
    transmission: 'Dual Clutch',
    fuelType: 'Petrol',
    color: 'Rosso Corsa',
    financeAvailable: false,
    status: 'sold',
    serviceHistory: 'Ferrari Classiche',
    description: 'Iconic Italian craftsmanship with the legendary twin-turbo V8.',
  },
  {
    id: '7',
    make: 'McLaren',
    model: '720S',
    variant: 'Spider',
    year: 2020,
    mileage: 6500,
    price: 5200000,
    images: [
      'https://images.unsplash.com/photo-1621135802920-133df287f89c?w=800&q=80',
      'https://images.unsplash.com/photo-1600712242805-5f78671b24da?w=800&q=80',
      'https://images.unsplash.com/photo-1568844293986-8c2a5a6e0b6d?w=800&q=80',
    ],
    transmission: 'Dual Clutch',
    fuelType: 'Petrol',
    color: 'Papaya Spark',
    financeAvailable: false,
    status: 'incoming',
    serviceHistory: 'McLaren Special Operations',
    description: 'Coming soon - The ultimate open-top supercar experience.',
  },
  {
    id: '8',
    make: 'BMW',
    model: 'M3',
    variant: 'Competition xDrive',
    year: 2023,
    mileage: 4200,
    price: 1580000,
    images: [
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80',
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',
    ],
    transmission: 'Automatic',
    fuelType: 'Petrol',
    color: 'Isle of Man Green',
    financeAvailable: true,
    status: 'available',
    serviceHistory: 'BMW Approved Used',
    description: 'All-wheel drive M3 with Individual paint and full carbon package.',
  },
];

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
