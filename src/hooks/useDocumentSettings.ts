import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OtpLineToggles, DEFAULT_LINE_TOGGLES } from '@/features/otp/types';
import type { DashboardPersistedState } from '@/components/admin/dashboard/types';

/** Customizable company / invoice / OTP document settings (stored as one JSON
 *  blob on site_settings.document_settings). Read directly from site_settings
 *  while admin-authenticated — these include banking/VAT and are NOT in the
 *  public site view. */
export interface DocumentSettings {
  // Company / brand
  companyLegalName: string;
  companyTradingName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyVatNumber: string;
  companyRegNumber: string;
  // Banking (for invoices)
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankAccountType: string;
  // Invoice
  invoicePrefix: string;
  invoiceNextNumber: number;
  invoiceTerms: string;
  /** Conditions of Sale paragraph printed on motor-trade vehicle invoices. */
  invoiceConditions: string;
  vatPercent: number;
  vatRegistered: boolean; // true = issue Tax Invoices with a VAT line (even at 0%); false = plain Invoice, no VAT
  defaultAdminFee: number;
  // OTP (Offer to Purchase)
  otpValidityDays: number;
  otpTerms: string; // optional override; empty = use the built-in legal terms
  otpPrefix: string; // ref prefix, e.g. "OTP-" (ref = prefix + year + "-" + NNNN)
  otpNextNumber: number; // next sequence number
  otpSalesExecutive: string; // default sales executive on new OTPs
  otpDefaultDeliveryFee: number;
  otpDefaultLicensing: number;
  otpLines: OtpLineToggles; // which fee lines are enabled by default
  // Quote (Quotation)
  quotePrefix: string; // ref prefix, e.g. "LA-Q-" (ref = prefix + NNNN, NO year)
  quoteNextNumber: number; // next sequence number
  quoteValidityDays: number; // how long a quote stays valid
  quoteSalesExecutive: string; // default sales executive on new quotes
  /** Quote Generator: renamed labels for the financed add-on lines, keyed by the
   *  stable addon id (admin/license/oem/service/dent/master/smash). Missing or
   *  empty key = use the built-in label. Display-only — the calc sums amounts. */
  quoteAddonLabels?: Record<string, string>;
  // Deals automation
  // When ON, marking a finance application "Contract Signed" auto-creates a DRAFT
  // deal_records row so the deal appears in Deal Desk ready to be finalized.
  // DEFAULT false — OFF means zero behaviour change anywhere.
  autoCreateDealOnContractSigned: boolean;
  // CarTrust credit-scan bookmark auto-clicks Generate Report when true.
  // DEFAULT false = fill + stop for manual review.
  creditScanAutoSubmit: boolean;
  // Bank branch codes — printed on the finance application PDF based on the client's bank.
  bankBranches: { bank: string; branchName: string; branchCode: string }[];
  // Sidebar appearance & navigation — admins can hide/show + reorder top-level
  // nav sections and items. ABSENT/empty => AdminSidebar falls back to its code
  // defaults; role filtering still applies on top of this regardless.
  navConfig?: NavConfig;
  /** Command Center (/admin) shared widget layout — ONE global layout for every
   *  staff member; only super-admins edit it (saved from the dashboard itself via
   *  useGlobalDashboardAdapter, not from a Settings page). ABSENT => the registry
   *  default layout. */
  commandDashboardLayout?: DashboardPersistedState;
  // Deal Desk checklist — the configurable items shown in the 3-section deal
  // Checklist tab (Car Preparation / Delivery Preparation / Payout). Per-deal
  // state + uploads live in deal_checklist_docs keyed by (section, item.key);
  // renaming a label keeps the key so history and files stay attached.
  dealChecklistConfig?: DealChecklistConfig;
}

// ---- Deal Desk checklist config ---------------------------------------------

export type DealChecklistSectionKey = 'car_prep' | 'delivery_prep' | 'payout';

/** A configured checklist item AS STORED. `requiresDoc` is optional on purpose:
 *  every item written before the toggle existed offered a document upload, so an
 *  ABSENT value must keep meaning "yes, ask for a document". Only an explicit
 *  `false` turns the upload affordance off. Normalise with
 *  `resolveDealChecklistConfig` (or `normalizeDealChecklistItem`) before reading it. */
export interface DealChecklistItem { key: string; label: string; requiresDoc?: boolean }
export type DealChecklistConfig = Record<DealChecklistSectionKey, DealChecklistItem[]>;

/** Post-normalisation item — `requiresDoc` is always a concrete boolean, so UI
 *  code never has to re-apply the undefined-means-true rule. */
export type ResolvedDealChecklistItem = DealChecklistItem & { requiresDoc: boolean };
export type ResolvedDealChecklistConfig = Record<DealChecklistSectionKey, ResolvedDealChecklistItem[]>;

/** undefined / missing => true (backward compatible); only explicit false is off. */
export const normalizeDealChecklistItem = (it: DealChecklistItem): ResolvedDealChecklistItem => ({
  ...it,
  requiresDoc: it.requiresDoc !== false,
});

/** The three fixed checklist sections, in display order. */
export const DEAL_CHECKLIST_SECTIONS: { key: DealChecklistSectionKey; label: string }[] = [
  { key: 'car_prep', label: 'Car Preparation' },
  { key: 'delivery_prep', label: 'Delivery Preparation' },
  { key: 'payout', label: 'Payout' },
];

// Defaults seeded from the previous fixed 8-step checklist (+ new payout steps).
// `requiresDoc: false` = a physical prep task with no paperwork to attach.
export const DEFAULT_DEAL_CHECKLIST_CONFIG: ResolvedDealChecklistConfig = {
  car_prep: [
    { key: 'recon', label: 'Recon', requiresDoc: true },
    { key: 'dekra', label: 'Dekra', requiresDoc: true },
    { key: 'eighty_point', label: '80-point inspection', requiresDoc: true },
    { key: 'service_warranty_plan', label: 'Service & warranty plan', requiresDoc: true },
    { key: 'service_history', label: 'Service history', requiresDoc: true },
    { key: 'fitments', label: 'Fitments', requiresDoc: true },
    { key: 'valet', label: 'Valet', requiresDoc: false },
  ],
  delivery_prep: [
    { key: 'fica', label: 'FICA', requiresDoc: true },
    { key: 'insurance', label: 'Insurance', requiresDoc: true },
    { key: 'fuel_keys_permit', label: 'Fuel, keys & permit', requiresDoc: false },
    { key: 'delivery_note', label: 'Delivery note', requiresDoc: true },
    { key: 'delivery_photos', label: 'Delivery photos', requiresDoc: true },
  ],
  payout: [
    { key: 'settlement_letter', label: 'Settlement letter', requiresDoc: true },
    { key: 'invoice_to_bank', label: 'Invoice to bank', requiresDoc: true },
    { key: 'proof_of_payment', label: 'Proof of payment', requiresDoc: true },
    { key: 'commission_sheet', label: 'Commission sheet', requiresDoc: true },
    // The NATIS chain, in the order the document changes hands.
    { key: 'natis_before_dealer_stock', label: 'Natis (before dealer stock)', requiresDoc: true },
    { key: 'dealer_stock_natis_lumina', label: 'Natis Makhulu', requiresDoc: true },
    { key: 'dealerstock_natis_up', label: 'Natis UP', requiresDoc: true },
    { key: 'dealerstock_natis_bank_client', label: 'Natis Client & Bank', requiresDoc: true },
  ],
};

/** A stored section => normalised item-for-item; an ABSENT section => defaults.
 *  A present-but-emptied array stays empty (the owner deliberately cleared it). */
const resolveSection = (
  items: DealChecklistItem[] | null | undefined,
  fallback: ResolvedDealChecklistItem[],
): ResolvedDealChecklistItem[] =>
  Array.isArray(items) ? items.map(normalizeDealChecklistItem) : fallback;

/** Stored config → full 3-section config with every item normalised, so all
 *  consumers get a concrete `requiresDoc` boolean. */
export const resolveDealChecklistConfig = (
  cfg?: Partial<DealChecklistConfig> | null,
): ResolvedDealChecklistConfig => ({
  car_prep: resolveSection(cfg?.car_prep, DEFAULT_DEAL_CHECKLIST_CONFIG.car_prep),
  delivery_prep: resolveSection(cfg?.delivery_prep, DEFAULT_DEAL_CHECKLIST_CONFIG.delivery_prep),
  payout: resolveSection(cfg?.payout, DEFAULT_DEAL_CHECKLIST_CONFIG.payout),
});

// Per-section / per-item nav overrides keyed by stable ids (see lib/navDefaults).
export interface NavItemOverride { hidden?: boolean }
export interface NavSectionOverride {
  hidden?: boolean;
  order?: string[]; // ordered item ids; unknown/new ids appended in code order
  items?: Record<string, NavItemOverride>;
}
export interface NavConfig {
  sectionOrder?: string[]; // ordered section ids; unknown/new sections appended in code order
  sections?: Record<string, NavSectionOverride>;
}

// South African universal branch codes (editable in Settings → Branch Codes).
export const DEFAULT_BANK_BRANCHES: { bank: string; branchName: string; branchCode: string }[] = [
  { bank: 'ABSA', branchName: 'Universal Branch', branchCode: '632005' },
  { bank: 'African Bank', branchName: 'Universal Branch', branchCode: '430000' },
  { bank: 'Bidvest Bank', branchName: 'Universal Branch', branchCode: '462005' },
  { bank: 'Capitec', branchName: 'Universal Branch', branchCode: '470010' },
  { bank: 'Discovery Bank', branchName: 'Universal Branch', branchCode: '679000' },
  { bank: 'FNB', branchName: 'Universal Branch', branchCode: '250655' },
  { bank: 'Grindrod Bank', branchName: 'Universal Branch', branchCode: '584000' },
  { bank: 'Investec', branchName: 'Universal Branch', branchCode: '580105' },
  { bank: 'Nedbank', branchName: 'Universal Branch', branchCode: '198765' },
  { bank: 'Sasfin', branchName: 'Universal Branch', branchCode: '683000' },
  { bank: 'Standard Bank', branchName: 'Universal Branch', branchCode: '051001' },
  { bank: 'TymeBank', branchName: 'Universal Branch', branchCode: '678910' },
  { bank: 'WesBank', branchName: 'Universal Branch', branchCode: '250655' },
];

/** Look up a client's bank (any spelling/case) against the configured branch list. */
export const lookupBankBranch = (
  bankName: string | null | undefined,
  branches: { bank: string; branchName: string; branchCode: string }[] | undefined,
) => {
  if (!bankName) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const key = norm(bankName);
  return (branches ?? DEFAULT_BANK_BRANCHES).find((b) => norm(b.bank) === key) ?? null;
};

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  companyLegalName: 'MAKHULU HOLDINGS (PTY) LTD',
  companyTradingName: 'Lumina Auto',
  companyAddress: 'Pretoria, South Africa',
  companyPhone: '068 601 7462',
  companyEmail: 'info@luminaauto.co.za',
  companyVatNumber: '',
  companyRegNumber: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankBranchCode: '',
  bankAccountType: 'Cheque',
  invoicePrefix: 'INV-',
  invoiceNextNumber: 1001,
  invoiceTerms: 'Payment due on delivery. The vehicle remains the property of the seller until paid in full.',
  invoiceConditions:
    'It is an express condition of this sale that ownership in the goods hereby sold shall remain vested in the seller ' +
    'until such time as any cheque, promissory note, bill of exchange, or other negotiable instrument tendered in payment ' +
    'has been honoured and the full purchase price of the said goods has been paid to the seller.',
  vatPercent: 15,
  vatRegistered: false,
  defaultAdminFee: 2500,
  otpValidityDays: 7,
  otpTerms: '',
  otpPrefix: 'OTP-',
  otpNextNumber: 1,
  otpSalesExecutive: 'Albert Prinsloo',
  otpDefaultDeliveryFee: 0,
  otpDefaultLicensing: 0,
  otpLines: DEFAULT_LINE_TOGGLES,
  quotePrefix: 'LA-Q-',
  quoteNextNumber: 1,
  quoteValidityDays: 7,
  quoteSalesExecutive: '',
  quoteAddonLabels: {},
  autoCreateDealOnContractSigned: false,
  creditScanAutoSubmit: false,
  bankBranches: DEFAULT_BANK_BRANCHES,
  navConfig: {},
  dealChecklistConfig: DEFAULT_DEAL_CHECKLIST_CONFIG,
};

export const useDocumentSettings = () => {
  return useQuery({
    queryKey: ['document-settings'],
    queryFn: async (): Promise<DocumentSettings> => {
      // Cast: document_settings is a newly-added column not yet in generated types.
      const { data } = await (supabase as any)
        .from('site_settings').select('document_settings').limit(1).maybeSingle();
      const stored = (data?.document_settings || {}) as Partial<DocumentSettings>;
      return { ...DEFAULT_DOCUMENT_SETTINGS, ...stored };
    },
  });
};

export const useUpdateDocumentSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: DocumentSettings) => {
      const { data: row } = await (supabase as any)
        .from('site_settings').select('id').limit(1).maybeSingle();
      if (row?.id) {
        const { error } = await (supabase as any)
          .from('site_settings').update({ document_settings: settings }).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('site_settings').insert({ document_settings: settings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-settings'] });
      toast.success('Document settings saved');
    },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

/** Zero-padded invoice number display, e.g. INV-01001. */
export const formatInvoiceNumber = (settings: Pick<DocumentSettings, 'invoicePrefix' | 'invoiceNextNumber'>): string =>
  `${settings.invoicePrefix || 'INV-'}${String(settings.invoiceNextNumber || 1001).padStart(5, '0')}`;

/** Returns the formatted invoice number to use now, and bumps the stored counter.
 *  The counter is read from the FRESHLY-fetched row (not the react-query cache),
 *  so back-to-back generates in one session never reuse a number. */
export const consumeInvoiceNumber = async (current: DocumentSettings): Promise<string> => {
  const { data: row } = await (supabase as any)
    .from('site_settings').select('id, document_settings').limit(1).maybeSingle();
  const stored = (row?.document_settings || {}) as Partial<DocumentSettings>;
  const num = stored.invoiceNextNumber || current.invoiceNextNumber || 1001;
  if (row?.id) {
    const merged = { ...DEFAULT_DOCUMENT_SETTINGS, ...stored, invoiceNextNumber: num + 1 };
    await (supabase as any).from('site_settings').update({ document_settings: merged }).eq('id', row.id);
  }
  return `${stored.invoicePrefix || current.invoicePrefix || 'INV-'}${String(num).padStart(5, '0')}`;
};

/** Returns the OTP reference to use now (e.g. OTP-2026-0001) and bumps the stored counter. */
export const consumeOtpNumber = async (current: DocumentSettings): Promise<string> => {
  const num = current.otpNextNumber || 1;
  const year = new Date().getFullYear();
  const { data: row } = await (supabase as any)
    .from('site_settings').select('id, document_settings').limit(1).maybeSingle();
  if (row?.id) {
    const merged = { ...DEFAULT_DOCUMENT_SETTINGS, ...(row.document_settings || {}), otpNextNumber: num + 1 };
    await (supabase as any).from('site_settings').update({ document_settings: merged }).eq('id', row.id);
  }
  return `${current.otpPrefix || 'OTP-'}${year}-${String(num).padStart(4, '0')}`;
};

/** Returns the quote reference to use now (e.g. LA-Q-0147 — 4-digit, NO year) and bumps the stored counter. */
export const consumeQuoteNumber = async (current: DocumentSettings): Promise<string> => {
  const num = current.quoteNextNumber || 1;
  const { data: row } = await (supabase as any)
    .from('site_settings').select('id, document_settings').limit(1).maybeSingle();
  if (row?.id) {
    const merged = { ...DEFAULT_DOCUMENT_SETTINGS, ...(row.document_settings || {}), quoteNextNumber: num + 1 };
    await (supabase as any).from('site_settings').update({ document_settings: merged }).eq('id', row.id);
  }
  return `${current.quotePrefix || 'LA-Q-'}${String(num).padStart(4, '0')}`;
};
