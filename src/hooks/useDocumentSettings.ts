import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OtpLineToggles, DEFAULT_LINE_TOGGLES } from '@/features/otp/types';

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
  // Bank branch codes — printed on the finance application PDF based on the client's bank.
  bankBranches: { bank: string; branchName: string; branchCode: string }[];
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
  bankBranches: DEFAULT_BANK_BRANCHES,
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

/** Returns the formatted invoice number to use now, and bumps the stored counter. */
export const consumeInvoiceNumber = async (current: DocumentSettings): Promise<string> => {
  const num = current.invoiceNextNumber || 1001;
  const { data: row } = await (supabase as any)
    .from('site_settings').select('id, document_settings').limit(1).maybeSingle();
  if (row?.id) {
    const merged = { ...DEFAULT_DOCUMENT_SETTINGS, ...(row.document_settings || {}), invoiceNextNumber: num + 1 };
    await (supabase as any).from('site_settings').update({ document_settings: merged }).eq('id', row.id);
  }
  return `${current.invoicePrefix || 'INV-'}${num}`;
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
