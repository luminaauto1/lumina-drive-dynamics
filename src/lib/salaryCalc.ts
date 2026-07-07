// SA payroll engine for the admin-only Salary Calculator (Settings → Salary Calculator).
//
// Method: SARS "annualised balance of remuneration" PAYE — the monthly taxable
// remuneration is annualised (×12), annual tax is computed from the bracket table,
// the age rebate is subtracted, and the result is divided back by 12. UIF is 1%
// of remuneration capped at the UIF ceiling (employee side; the employer matches
// it but that never reduces the employee's net).
//
// The tax tables are CONFIGURABLE (stored in integration_settings key
// 'salary_tax_tables' and editable in the UI) so the admin can update them after
// each February Budget without a code change. The bundled default is the last
// table known at build time.

export interface TaxBracket {
  upTo: number | null; // null = no upper bound
  base: number;        // tax on the bracket floor
  rate: number;        // marginal rate ABOVE the floor (0.18 = 18%)
  floor: number;       // bracket floor (annual taxable income)
}

export interface TaxTables {
  label: string;             // e.g. "2025/26 (SARS)"
  brackets: TaxBracket[];    // ascending by floor
  rebates: { under_65: number; from_65: number; from_75: number }; // annual rebates (cumulative values)
  uifRate: number;           // employee rate (0.01)
  uifMonthlyCeiling: number; // remuneration ceiling per month (R17,712)
}

// SARS 2025/26 (1 Mar 2025 – 28 Feb 2026); brackets were left unchanged by the
// 2025 Budget. Verify against the 2026 Budget and update in the UI if needed.
export const DEFAULT_TAX_TABLES: TaxTables = {
  label: '2025/26 (SARS) — update after each February Budget',
  brackets: [
    { floor: 0,       upTo: 237100,  base: 0,      rate: 0.18 },
    { floor: 237100,  upTo: 370500,  base: 42678,  rate: 0.26 },
    { floor: 370500,  upTo: 512800,  base: 77362,  rate: 0.31 },
    { floor: 512800,  upTo: 673000,  base: 121475, rate: 0.36 },
    { floor: 673000,  upTo: 857900,  base: 179147, rate: 0.39 },
    { floor: 857900,  upTo: 1817000, base: 251258, rate: 0.41 },
    { floor: 1817000, upTo: null,    base: 644489, rate: 0.45 },
  ],
  rebates: { under_65: 17235, from_65: 17235 + 9444, from_75: 17235 + 9444 + 3145 },
  uifRate: 0.01,
  uifMonthlyCeiling: 17712,
};

export type AgeBand = 'under_65' | 'from_65' | 'from_75';

export interface CustomDeduction { label: string; amount: number }

export interface SalaryInput {
  grossBasic: number;        // monthly basic
  fixedAllowances?: number;  // monthly taxable allowances
  commission?: number;       // this month's commission (taxable)
  pensionPercent?: number;   // employee retirement contribution as % of basic (s11F deductible)
  ageBand?: AgeBand;
  customDeductions?: CustomDeduction[]; // after-tax deductions (loans, advances, …)
  tables?: TaxTables;
}

export interface SalaryResult {
  grossMonthly: number;        // basic + allowances + commission
  pensionMonthly: number;      // employee retirement contribution
  taxableMonthly: number;      // gross − pension (s11F, capped)
  annualTaxable: number;
  payeAnnualBeforeRebate: number;
  rebateAnnual: number;
  payeMonthly: number;
  uifMonthly: number;
  customDeductionsTotal: number;
  netMonthly: number;
  effectiveTaxRate: number;    // PAYE / gross
  marginalRate: number;
  tablesLabel: string;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function annualTaxFor(annualTaxable: number, tables: TaxTables): { tax: number; marginalRate: number } {
  const t = Math.max(0, annualTaxable);
  let b = tables.brackets[0];
  for (const br of tables.brackets) {
    if (t >= br.floor && (br.upTo === null || t < br.upTo)) { b = br; break; }
    if (br.upTo !== null && t >= br.upTo) b = br; // walk up; last matching stays
  }
  return { tax: b.base + (t - b.floor) * b.rate, marginalRate: b.rate };
}

export function calcSalary(input: SalaryInput): SalaryResult {
  const tables = input.tables ?? DEFAULT_TAX_TABLES;
  const basic = Math.max(0, +input.grossBasic || 0);
  const allow = Math.max(0, +(input.fixedAllowances ?? 0) || 0);
  const comm = Math.max(0, +(input.commission ?? 0) || 0);
  const grossMonthly = basic + allow + comm;

  // Retirement contribution: deductible up to 27.5% of remuneration (annual cap
  // R350,000 — far above dealership salaries, but enforced anyway).
  const pensionRaw = basic * (Math.max(0, +(input.pensionPercent ?? 0) || 0) / 100);
  const pensionCapMonthly = Math.min(grossMonthly * 0.275, 350000 / 12);
  const pensionMonthly = Math.min(pensionRaw, pensionCapMonthly);

  const taxableMonthly = Math.max(0, grossMonthly - pensionMonthly);
  const annualTaxable = taxableMonthly * 12;

  const { tax: payeAnnualBeforeRebate, marginalRate } = annualTaxFor(annualTaxable, tables);
  const rebateAnnual = tables.rebates[input.ageBand ?? 'under_65'] ?? tables.rebates.under_65;
  const payeAnnual = Math.max(0, payeAnnualBeforeRebate - rebateAnnual);
  const payeMonthly = payeAnnual / 12;

  const uifMonthly = Math.min(grossMonthly, tables.uifMonthlyCeiling) * tables.uifRate;

  const customDeductionsTotal = (input.customDeductions ?? [])
    .reduce((a, d) => a + Math.max(0, +d.amount || 0), 0);

  const netMonthly = grossMonthly - pensionMonthly - payeMonthly - uifMonthly - customDeductionsTotal;

  return {
    grossMonthly: r2(grossMonthly),
    pensionMonthly: r2(pensionMonthly),
    taxableMonthly: r2(taxableMonthly),
    annualTaxable: r2(annualTaxable),
    payeAnnualBeforeRebate: r2(payeAnnualBeforeRebate),
    rebateAnnual: r2(rebateAnnual),
    payeMonthly: r2(payeMonthly),
    uifMonthly: r2(uifMonthly),
    customDeductionsTotal: r2(customDeductionsTotal),
    netMonthly: r2(netMonthly),
    effectiveTaxRate: grossMonthly > 0 ? r2((payeMonthly / grossMonthly) * 100) : 0,
    marginalRate: r2(marginalRate * 100),
    tablesLabel: tables.label,
  };
}

export const fmtR = (v: number) =>
  'R ' + (v ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
