// Admin → Settings → Salary Calculator — ADMIN-ONLY payroll workbench.
//
// SECURITY MODEL (why this stays private):
//  • staff_salaries has admin-only RLS on every command (FORCEd) — no other role,
//    no anon path, no edge function reads it. The registry entry is also
//    requireSuperAdmin, so the page never even renders for non-admins.
//  • Calculations run entirely in this browser tab; nothing is sent anywhere
//    except the admin-only Supabase table.
//
// Features: quick once-off calculator (gross → PAYE/UIF/net with full breakdown),
// an employee register (basic, allowances, pension %, age band, after-tax
// deductions), per-employee monthly commission entry with live net, a payroll
// totals row, and editable SARS tax tables (update after each February Budget).
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Plus, Trash2, Calculator, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  calcSalary, fmtR, DEFAULT_TAX_TABLES,
  type TaxTables, type AgeBand, type CustomDeduction,
} from '@/lib/salaryCalc';

const db = supabase as any;

interface StaffSalary {
  id: string;
  employee_name: string;
  role_title: string | null;
  gross_basic: number;
  fixed_allowances: number;
  pension_percent: number;
  age_band: AgeBand;
  custom_deductions: CustomDeduction[];
  notes: string | null;
  active: boolean;
}

const useStaffSalaries = () =>
  useQuery({
    queryKey: ['staff-salaries'],
    queryFn: async (): Promise<StaffSalary[]> => {
      const { data, error } = await db.from('staff_salaries').select('*').order('employee_name');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, custom_deductions: Array.isArray(r.custom_deductions) ? r.custom_deductions : [] }));
    },
  });

const useTaxTables = () =>
  useQuery({
    queryKey: ['integration', 'salary_tax_tables'],
    queryFn: async (): Promise<TaxTables> => {
      const { data, error } = await db.from('integration_settings').select('config').eq('key', 'salary_tax_tables').maybeSingle();
      if (error) throw error;
      const cfg = data?.config;
      return cfg && Array.isArray(cfg.brackets) && cfg.brackets.length ? (cfg as TaxTables) : DEFAULT_TAX_TABLES;
    },
  });

const AGE_LABEL: Record<AgeBand, string> = { under_65: 'Under 65', from_65: '65 – 74', from_75: '75+' };

const SalaryCalculatorTab = () => {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useStaffSalaries();
  const { data: tables = DEFAULT_TAX_TABLES } = useTaxTables();

  /* ---------- quick once-off calculator ---------- */
  const [qGross, setQGross] = useState('');
  const [qAllow, setQAllow] = useState('');
  const [qComm, setQComm] = useState('');
  const [qPension, setQPension] = useState('');
  const [qAge, setQAge] = useState<AgeBand>('under_65');
  const quick = useMemo(() => calcSalary({
    grossBasic: +qGross || 0, fixedAllowances: +qAllow || 0, commission: +qComm || 0,
    pensionPercent: +qPension || 0, ageBand: qAge, tables,
  }), [qGross, qAllow, qComm, qPension, qAge, tables]);

  /* ---------- employee register ---------- */
  const [commissionById, setCommissionById] = useState<Record<string, string>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const upsert = useMutation({
    mutationFn: async (row: Partial<StaffSalary> & { id?: string }) => {
      const payload: any = { ...row, updated_at: new Date().toISOString() };
      const { error } = row.id
        ? await db.from('staff_salaries').update(payload).eq('id', row.id)
        : await db.from('staff_salaries').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-salaries'] }); toast.success('Saved'); },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from('staff_salaries').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-salaries'] }); toast.success('Employee removed'); },
    onError: (e: any) => toast.error('Delete failed: ' + e.message),
  });

  const [draft, setDraft] = useState<Partial<StaffSalary> | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StaffSalary | null>(null);

  const visible = rows.filter((r) => showInactive || r.active);
  const payroll = visible.filter((r) => r.active).map((r) => ({
    row: r,
    calc: calcSalary({
      grossBasic: r.gross_basic, fixedAllowances: r.fixed_allowances,
      commission: +(commissionById[r.id] ?? 0) || 0, pensionPercent: r.pension_percent,
      ageBand: r.age_band, customDeductions: r.custom_deductions, tables,
    }),
  }));
  const totals = payroll.reduce((a, p) => ({
    gross: a.gross + p.calc.grossMonthly, paye: a.paye + p.calc.payeMonthly,
    uif: a.uif + p.calc.uifMonthly, net: a.net + p.calc.netMonthly,
  }), { gross: 0, paye: 0, uif: 0, net: 0 });

  /* ---------- editable tax tables ---------- */
  const [tablesOpen, setTablesOpen] = useState(false);
  const [tablesDraft, setTablesDraft] = useState<string>('');
  useEffect(() => { setTablesDraft(JSON.stringify(tables, null, 2)); }, [tables]);
  const saveTables = useMutation({
    mutationFn: async () => {
      let parsed: TaxTables;
      try { parsed = JSON.parse(tablesDraft); } catch { throw new Error('Invalid JSON'); }
      if (!Array.isArray(parsed.brackets) || !parsed.brackets.length || !parsed.rebates) throw new Error('Tables need brackets[] and rebates{}');
      const { error } = await db.from('integration_settings')
        .upsert({ key: 'salary_tax_tables', active: true, config: parsed, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'salary_tax_tables'] }); toast.success('Tax tables saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const numInput = (v: string, set: (s: string) => void, ph: string) => (
    <Input type="number" inputMode="decimal" value={v} placeholder={ph} onChange={(e) => set(e.target.value)} className="text-right" />
  );

  return (
    // Width comes from the page shell (SettingsPageLayout) — this page is 'wide'.
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Calculator className="w-4 h-4 shrink-0 text-emerald-400" />
        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 px-1.5 py-0.5 text-[11px] text-emerald-400/90">
          <ShieldCheck className="w-3 h-3 shrink-0" /> Admin-only — data locked by row-level security
        </span>
      </div>

      {/* Quick calculator */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Quick calculation ({tables.label})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1"><Label className="text-xs">Basic (monthly)</Label>{numInput(qGross, setQGross, '25000')}</div>
            <div className="space-y-1"><Label className="text-xs">Allowances</Label>{numInput(qAllow, setQAllow, '0')}</div>
            <div className="space-y-1"><Label className="text-xs">Commission</Label>{numInput(qComm, setQComm, '0')}</div>
            <div className="space-y-1"><Label className="text-xs">Pension %</Label>{numInput(qPension, setQPension, '0')}</div>
            <div className="space-y-1"><Label className="text-xs">Age</Label>
              <Select value={qAge} onValueChange={(v) => setQAge(v as AgeBand)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(AGE_LABEL) as AgeBand[]).map((k) => <SelectItem key={k} value={k}>{AGE_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="rounded-md border border-border p-2"><div className="text-[11px] text-muted-foreground">Gross</div><div className="font-semibold">{fmtR(quick.grossMonthly)}</div></div>
            <div className="rounded-md border border-border p-2"><div className="text-[11px] text-muted-foreground">PAYE (eff. {quick.effectiveTaxRate}%, marginal {quick.marginalRate}%)</div><div className="font-semibold text-red-400">− {fmtR(quick.payeMonthly)}</div></div>
            <div className="rounded-md border border-border p-2"><div className="text-[11px] text-muted-foreground">UIF (1%, capped)</div><div className="font-semibold text-red-400">− {fmtR(quick.uifMonthly)}</div></div>
            <div className="rounded-md border border-emerald-500/40 p-2 bg-emerald-500/5"><div className="text-[11px] text-muted-foreground">Net take-home</div><div className="font-bold text-emerald-400">{fmtR(quick.netMonthly)}</div></div>
          </div>
          {quick.pensionMonthly > 0 && (
            <p className="text-[11px] text-muted-foreground">Pension {fmtR(quick.pensionMonthly)} deducted before tax (s11F). Annual taxable {fmtR(quick.annualTaxable)}, rebate {fmtR(quick.rebateAnnual)}.</p>
          )}
        </CardContent>
      </Card>

      {/* Employee register + payroll */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">Employees & monthly payroll</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={showInactive} onCheckedChange={setShowInactive} /> show inactive</label>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setDraft({ employee_name: '', gross_basic: 0, fixed_allowances: 0, pension_percent: 0, age_band: 'under_65', custom_deductions: [], active: true })}>
              <Plus className="w-4 h-4" /> Add employee
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft && (
            <div className="rounded-lg border border-emerald-500/40 p-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={draft.employee_name ?? ''} onChange={(e) => setDraft({ ...draft, employee_name: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Role</Label><Input value={draft.role_title ?? ''} onChange={(e) => setDraft({ ...draft, role_title: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Age band</Label>
                  <Select value={draft.age_band ?? 'under_65'} onValueChange={(v) => setDraft({ ...draft, age_band: v as AgeBand })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(AGE_LABEL) as AgeBand[]).map((k) => <SelectItem key={k} value={k}>{AGE_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Basic (monthly)</Label><Input type="number" value={draft.gross_basic ?? 0} onChange={(e) => setDraft({ ...draft, gross_basic: +e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Allowances</Label><Input type="number" value={draft.fixed_allowances ?? 0} onChange={(e) => setDraft({ ...draft, fixed_allowances: +e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Pension %</Label><Input type="number" value={draft.pension_percent ?? 0} onChange={(e) => setDraft({ ...draft, pension_percent: +e.target.value })} /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                <Button size="sm" className="gap-1" disabled={!String(draft.employee_name ?? '').trim() || upsert.isPending}
                  onClick={() => upsert.mutate(draft as any, { onSuccess: () => setDraft(null) })}>
                  <Save className="w-4 h-4" /> Save employee
                </Button>
              </div>
            </div>
          )}

          {visible.length === 0 && !draft && <p className="text-sm text-muted-foreground">No employees yet — add your staff to run monthly payroll here.</p>}

          {payroll.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 pr-2">Employee</th>
                    <th className="text-right px-2">Basic</th>
                    <th className="text-right px-2">Commission (this month)</th>
                    <th className="text-right px-2">PAYE</th>
                    <th className="text-right px-2">UIF</th>
                    <th className="text-right px-2">Other ded.</th>
                    <th className="text-right pl-2">Net pay</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map(({ row, calc }) => (
                    <>
                      <tr key={row.id} className="border-b border-border">
                        <td className="py-1.5 pr-2">
                          <div className="font-medium">{row.employee_name}</div>
                          <div className="text-[11px] text-muted-foreground">{row.role_title || '—'} · {AGE_LABEL[row.age_band]}</div>
                        </td>
                        <td className="text-right px-2">{fmtR(row.gross_basic + row.fixed_allowances)}</td>
                        <td className="text-right px-2">
                          <Input type="number" inputMode="decimal" className="h-7 w-28 ml-auto text-right"
                            value={commissionById[row.id] ?? ''}
                            placeholder="0"
                            onChange={(e) => setCommissionById((m) => ({ ...m, [row.id]: e.target.value }))} />
                        </td>
                        <td className="text-right px-2 text-red-400">− {fmtR(calc.payeMonthly)}</td>
                        <td className="text-right px-2 text-red-400">− {fmtR(calc.uifMonthly)}</td>
                        <td className="text-right px-2 text-red-400">− {fmtR(calc.customDeductionsTotal + calc.pensionMonthly)}</td>
                        <td className="text-right pl-2 font-semibold text-emerald-400">{fmtR(calc.netMonthly)}</td>
                        <td className="pl-2 whitespace-nowrap">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                            {expanded === row.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmRemove(row)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                      {expanded === row.id && (
                        <tr key={row.id + '-x'} className="border-b border-border bg-muted/20">
                          <td colSpan={8} className="py-2 px-2">
                            <EmployeeEditor row={row} onSave={(patch) => upsert.mutate({ id: row.id, ...patch })} saving={upsert.isPending} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 pr-2 text-[11px] uppercase tracking-wide text-muted-foreground">Totals ({payroll.length})</td>
                    <td className="text-right px-2">{fmtR(totals.gross)}</td>
                    <td></td>
                    <td className="text-right px-2 text-red-400">− {fmtR(totals.paye)}</td>
                    <td className="text-right px-2 text-red-400">− {fmtR(totals.uif)}</td>
                    <td></td>
                    <td className="text-right pl-2 text-emerald-400">{fmtR(totals.net)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax tables editor */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Tax tables — {tables.label}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setTablesOpen(!tablesOpen)}>{tablesOpen ? 'Hide' : 'Edit'}</Button>
        </CardHeader>
        {tablesOpen && (
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Update after each February Budget: brackets (annual taxable income), rebates (annual, cumulative), UIF rate + monthly ceiling. JSON format — be careful.
            </p>
            <textarea
              className="w-full h-64 rounded-md border border-border bg-background p-2 font-mono text-xs"
              value={tablesDraft}
              onChange={(e) => setTablesDraft(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => saveTables.mutate()} disabled={saveTables.isPending}>
                {saveTables.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save tables
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove employee?"
        description={confirmRemove ? `Remove ${confirmRemove.employee_name} from the salary register?` : undefined}
        confirmLabel="Remove"
        onConfirm={() => { if (confirmRemove) remove.mutate(confirmRemove.id); setConfirmRemove(null); }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
};

// Inline per-employee editor (rates, allowances, after-tax deductions).
const EmployeeEditor = ({ row, onSave, saving }: { row: StaffSalary; onSave: (patch: Partial<StaffSalary>) => void; saving: boolean }) => {
  const [e, setE] = useState<StaffSalary>({ ...row });
  const setDed = (i: number, patch: Partial<CustomDeduction>) =>
    setE({ ...e, custom_deductions: e.custom_deductions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1"><Label className="text-xs">Basic</Label><Input type="number" value={e.gross_basic} onChange={(ev) => setE({ ...e, gross_basic: +ev.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Allowances</Label><Input type="number" value={e.fixed_allowances} onChange={(ev) => setE({ ...e, fixed_allowances: +ev.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Pension %</Label><Input type="number" value={e.pension_percent} onChange={(ev) => setE({ ...e, pension_percent: +ev.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Active</Label><div className="pt-1"><Switch checked={e.active} onCheckedChange={(v) => setE({ ...e, active: v })} /></div></div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">After-tax deductions (loans, advances…)</Label>
        {e.custom_deductions.map((d, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input className="h-8" value={d.label} placeholder="Label" onChange={(ev) => setDed(i, { label: ev.target.value })} />
            <Input className="h-8 w-32 text-right" type="number" value={d.amount} onChange={(ev) => setDed(i, { amount: +ev.target.value })} />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setE({ ...e, custom_deductions: e.custom_deductions.filter((_, idx) => idx !== i) })}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => setE({ ...e, custom_deductions: [...e.custom_deductions, { label: '', amount: 0 }] })}><Plus className="w-3.5 h-3.5" /> Add deduction</Button>
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="gap-1" disabled={saving} onClick={() => onSave({
          gross_basic: e.gross_basic, fixed_allowances: e.fixed_allowances, pension_percent: e.pension_percent,
          active: e.active, custom_deductions: e.custom_deductions.filter((d) => d.label.trim() || d.amount > 0),
        })}>
          <Save className="w-4 h-4" /> Save changes
        </Button>
      </div>
    </div>
  );
};

export default SalaryCalculatorTab;
