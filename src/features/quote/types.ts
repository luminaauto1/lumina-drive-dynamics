// Quotation — data model. Mirrors src/features/otp/types.ts.
// Makhulu Holdings (Pty) Ltd t/a Lumina Auto.
// The persisted snapshot rendered by the Quote document.

export interface QuoteCompany {
  legal_name: string;
  trading_name: string;
  address: string;
  email: string;
  phone: string;
  reg_no: string;
  vat_no: string; // "" until VAT registered
}

export interface QuoteMeta {
  ref: string; // e.g. LA-Q-0147
  date: string; // display date, "07 Jul 2026"
  valid_until: string; // display date, "14 Jul 2026"
  valid_until_iso: string; // ISO "YYYY-MM-DD" for the quotes.valid_until date column
  validity_days: number;
}

export interface QuoteClient {
  name: string;
  id_number: string;
  cell: string;
  email: string;
  address: string;
}

export interface QuoteVehicle {
  year: string;
  make: string;
  model: string;
  variant: string;
  title: string; // display title, e.g. "BMW 320i M Sport Steptronic (G20)"
  color: string;
  mileage: string;
  reg_no: string;
  vin: string;
  engine_no: string;
  mm_code: string;
  stock_no: string;
  transmission: string;
  image_url: string | null; // primary image; null => no-image placeholder variant
}

export interface QuoteLineItem {
  description: string;
  amount: number;
}

export interface QuoteSalesRep {
  name: string;
  cell: string;
}

export interface QuoteData {
  company: QuoteCompany;
  quote: QuoteMeta;
  client: QuoteClient;
  vehicle: QuoteVehicle;
  accessories: QuoteLineItem[];
  vaps: QuoteLineItem[]; // value added products
  retail_price: number;
  comments: string;
  sales_rep: QuoteSalesRep;
  vat_registered: boolean; // drives all VAT behaviour (see calcQuote)
  vat_number: string;
}

/** A persisted quote row (public.quotes). */
export interface QuoteRecord {
  id: string;
  ref: string;
  data: QuoteData;
  client_name: string | null;
  vehicle: string | null;
  total: number | null;
  valid_until: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
