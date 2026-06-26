// Offer to Purchase (OTP) — data model.
// Source of truth for layout/legal text: ./template.reference.html
// Makhulu Holdings (Pty) Ltd t/a Lumina Auto.

export type OrderType = 'Used' | 'New' | 'Demo';
export type FinanceMethod = 'Cash' | 'Bank Finance' | 'Unspecified';

export interface OtpCompany {
  legal_name: string;
  trading_name: string;
  address: string;
  email: string;
  phone: string;
  reg_no: string;
  vat_no: string; // "N/A" until VAT registered
}

export interface OtpClient {
  title: string;
  name: string;
  id: string;
  address: string;
  postal: string;
  email: string;
  cell: string;
}

export interface OtpSales {
  exec_name: string;
  exec_phone: string;
}

export interface OtpVehicle {
  make: string;
  model: string;
  year: string;
  reg_no: string;
  colour: string;
  trim: string;
  vin: string;
  engine_no: string;
  mileage: string;
  stock_no: string;
  mm_code: string;
  order_type: OrderType;
}

export interface OtpFinance {
  method: FinanceMethod;
  financed_by: string;
  bank_branch: string;
  branch_phone: string;
  branch_contact: string;
}

/** Raw monetary inputs (numbers). Derived totals are computed by calcOtp(). */
export interface OtpFinancials {
  base_price: number;
  extras: number;
  vap: number; // value added products
  admin_fee: number;
  delivery_fee: number; // VATABLE
  licensing: number; // Licensing & Registration — NON-VATABLE statutory disbursement
  deposit: number;
}

/** Toggle individual fee lines off so unused/zero lines can be hidden from the document. */
export interface OtpLineToggles {
  extras: boolean;
  vap: boolean;
  admin_fee: boolean;
  delivery_fee: boolean;
  licensing: boolean;
}

export interface OtpData {
  company: OtpCompany;
  vat_registered: boolean; // drives all VAT behaviour (see calcOtp)
  offer: { ref: string; date: string; valid_until: string }; // dates YYYY/MM/DD
  client: OtpClient;
  sales: OtpSales;
  vehicle: OtpVehicle;
  finance: OtpFinance;
  notes: string;
  financials: OtpFinancials;
  lines: OtpLineToggles;
}

/** A persisted OTP row (public.otps). */
export interface OtpRecord {
  id: string;
  ref: string;
  data: OtpData;
  client_name: string | null;
  vehicle: string | null;
  balance: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_LINE_TOGGLES: OtpLineToggles = {
  extras: true,
  vap: true,
  admin_fee: true,
  delivery_fee: true,
  licensing: true,
};
