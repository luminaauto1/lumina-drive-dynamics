// Column registry for the finance-application CSV Export Builder.
// `key` is the finance_applications column (status is mapped to its label).
// Ported in spirit from ZTC's export/columns.ts, scoped to Lumina's schema.
import { STATUS_OPTIONS } from '@/lib/statusConfig';

export interface ExportColumn {
  key: string;          // finance_applications column
  label: string;        // CSV header
  default?: boolean;    // included on first load
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'created_at',          label: 'Date Received', default: true },
  { key: 'status',              label: 'Status', default: true },
  { key: 'internal_status',     label: 'Internal Status' },
  { key: 'full_name',           label: 'Full Name', default: true },
  { key: 'first_name',          label: 'First Name' },
  { key: 'last_name',           label: 'Last Name' },
  { key: 'phone',               label: 'Phone', default: true },
  { key: 'email',               label: 'Email', default: true },
  { key: 'id_number',           label: 'ID Number' },
  { key: 'id_type',             label: 'ID Type' },
  { key: 'nationality',         label: 'Nationality' },
  { key: 'gender',              label: 'Gender' },
  { key: 'marital_status',      label: 'Marital Status' },
  { key: 'marriage_type',       label: 'Marriage Type' },
  { key: 'street_address',      label: 'Address' },
  { key: 'area_code',           label: 'Area Code' },
  { key: 'employment_status',   label: 'Employment Status' },
  { key: 'employment_type',     label: 'Employment Type' },
  { key: 'employer_name',       label: 'Employer' },
  { key: 'job_title',           label: 'Job Title' },
  { key: 'employment_period',   label: 'Employment Period' },
  { key: 'gross_salary',        label: 'Gross Salary' },
  { key: 'net_salary',          label: 'Net Salary' },
  { key: 'monthly_income',      label: 'Monthly Income' },
  { key: 'additional_income',   label: 'Additional Income' },
  { key: 'bank_name',           label: 'Bank', default: true },
  { key: 'account_type',        label: 'Account Type' },
  { key: 'account_number',      label: 'Account Number' },
  { key: 'deposit_amount',      label: 'Deposit', default: true },
  { key: 'loan_term_months',    label: 'Loan Term (months)' },
  { key: 'approved_budget',     label: 'Approved Budget' },
  { key: 'credit_score_status', label: 'Credit Profile' },
  { key: 'credit_check_status', label: 'Credit Check Status' },
  { key: 'has_drivers_license', label: "Driver's License" },
  { key: 'preferred_vehicle_text', label: 'Preferred Vehicle' },
  { key: 'bank_reference',      label: 'Bank Reference', default: true },
  { key: 'deal_type',           label: 'Deal Type' },
  { key: 'buyer_type',          label: 'Buyer Type' },
  { key: 'source_of_funds',     label: 'Source of Funds' },
  { key: 'declined_reason',     label: 'Declined Reason' },
  { key: 'kin_name',            label: 'Next of Kin' },
  { key: 'kin_contact',         label: 'Next of Kin Contact' },
  { key: 'submission_source',   label: 'Submission Source' },
  { key: 'utm_source',          label: 'UTM Source' },
  { key: 'utm_medium',          label: 'UTM Medium' },
  { key: 'utm_campaign',        label: 'UTM Campaign' },
  { key: 'referrer',            label: 'Referrer' },
  { key: 'popia_consent',       label: 'POPIA Consent' },
  { key: 'is_invoiced',         label: 'Invoiced' },
  { key: 'is_archived',         label: 'Archived' },
  { key: 'status_updated_at',   label: 'Status Changed' },
  { key: 'updated_at',          label: 'Last Updated' },
];

export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter((c) => c.default).map((c) => c.key);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

const BOOL_KEYS = new Set(['has_drivers_license', 'popia_consent', 'is_invoiced', 'is_archived']);
const DATE_KEYS = new Set(['created_at', 'updated_at', 'status_updated_at']);

/** Format one cell value for CSV (status → label, booleans → Yes/No, timestamps → SAST date). */
export const formatExportValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  if (key === 'status') return STATUS_LABELS[String(value)] || String(value);
  if (BOOL_KEYS.has(key)) return value ? 'Yes' : 'No';
  if (DATE_KEYS.has(key)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  return String(value);
};
