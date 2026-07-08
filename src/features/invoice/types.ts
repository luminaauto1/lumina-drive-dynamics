// Invoice document types. InvoicePayload is the creator's full form state —
// persisted verbatim as invoices.payload (re-download / duplicate) and rendered
// by InvoiceDocument. Keep additive: bump `v` on breaking shape changes.

export interface InvoiceParty {
  name: string;
  regOrId: string;
  vatNumber: string;
  address: string;
  postalCode: string;
  email: string;
  phone: string;     // cell
  phoneWork: string; // landline / work
}

export const EMPTY_PARTY: InvoiceParty = {
  name: '', regOrId: '', vatNumber: '', address: '', postalCode: '', email: '', phone: '', phoneWork: '',
};

export interface InvoiceVehicle {
  make: string; model: string; variant: string; year: string; yearFirstReg: string;
  colour: string; km: string; mmCode: string; vin: string; engineNo: string;
  regNo: string; stockNo: string; features: string; dateSold: string; salesperson: string;
}

export interface InvoiceMisc { description: string; amountIncl: number; vatExempt: boolean }
export interface InvoiceGeneralLine { description: string; amount: number }

export interface InvoicePayload {
  /** Payload schema version — bump on breaking form-shape changes. */
  v?: number;
  mode: 'vehicle' | 'general';
  invoiceNumber: string;
  paymentReference: string;
  dateStr: string;
  taxInvoice: boolean;
  billTo: InvoiceParty;
  deliveredToEnabled: boolean;
  deliveredTo: InvoiceParty;
  vehicle: InvoiceVehicle;
  soldForIncl: number;
  /** Optional override for the vehicle line description (e.g. margin-basis deals). */
  soldForLabel?: string;
  miscItems: InvoiceMisc[];
  depositPaid: number;
  tradeInDeposit: number;
  generalItems: InvoiceGeneralLine[];
  notes: string;
}
