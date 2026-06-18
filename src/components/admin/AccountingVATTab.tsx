import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Receipt, TrendingUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { dealNetProfit, isFinalizedDeal } from '@/lib/dealMetrics';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

const fmtR = (val: number) =>
  `R ${Number(val || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;

interface AccountingDeal {
  id: string;
  application_id: string | null;
  sale_date: string | null;
  created_at: string;
  sold_price: number | null;
  gross_profit: number | null;
  cost_price: number | null;
  recon_cost: number | null;
  dic_amount: number | null;
  partner_profit_amount: number | null;
  partner_capital_contribution: number | null;
  sales_rep_commission: number | null;
  referral_commission_amount: number | null;
  addons_data: any[] | null;
  aftersales_expenses: any[] | null;
  is_closed: boolean | null;
  vehicle?: {
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    registration_number: string | null;
  } | null;
  application?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    id_number: string | null;
    phone: string | null;
    email: string | null;
    internal_status: string | null;
    status: string | null;
    is_invoiced: boolean | null;
    bank_reference: string | null;
    contract_bank_name: string | null;
  } | null;
}

const useAccountingDeals = () => {
  return useQuery({
    queryKey: ['accounting-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select(`
          id, application_id, sale_date, created_at, sold_price, gross_profit, cost_price, recon_cost,
          dic_amount, partner_profit_amount, partner_capital_contribution,
          sales_rep_commission, referral_commission_amount,
          addons_data, aftersales_expenses, is_closed,
          vehicle:vehicles(make, model, year, vin, registration_number),
          application:finance_applications(
            id, first_name, last_name, full_name, id_number, phone, email,
            internal_status, status, is_invoiced, bank_reference, contract_bank_name
          )
        `)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AccountingDeal[];
    },
  });
};

const sumAddons = (addons: any[] | null) =>
  Array.isArray(addons)
    ? addons.reduce((s, a) => s + (Number(a?.price) || 0), 0)
    : 0;

const sumLicensing = (expenses: any[] | null) => {
  if (!Array.isArray(expenses)) return 0;
  return expenses.reduce((s, e) => {
    const label = String(e?.name || e?.description || e?.type || '').toLowerCase();
    if (
      label.includes('licens') ||
      label.includes('registr') ||
      label.includes('disc') ||
      label.includes('natis')
    ) {
      return s + (Number(e?.amount || e?.price || e?.cost) || 0);
    }
    return s;
  }, 0);
};

// Net profit ALWAYS comes from the canonical stored value (deal_records.gross_profit)
// via dealNetProfit() — the exact figure the Deal Ledger, Dashboard, Analytics and the
// other Report tabs already use. Re-deriving it here is what produced the partner-deal
// "losses": the old formula subtracted partner_capital_contribution (the partner's
// returned capital, already inside cost_price) as if it were an expense.

const AccountingVATTab = () => {
  const { data: deals = [], isLoading } = useAccountingDeals();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [activeDeal, setActiveDeal] = useState<AccountingDeal | null>(null);

  const toggleInvoiced = useMutation({
    mutationFn: async ({ appId, value }: { appId: string; value: boolean }) => {
      const { error } = await supabase
        .from('finance_applications')
        .update({ is_invoiced: value })
        .eq('id', appId);
      if (error) throw error;
    },
    onMutate: async ({ appId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['accounting-deals'] });
      const prev = queryClient.getQueryData<AccountingDeal[]>(['accounting-deals']);
      queryClient.setQueryData<AccountingDeal[]>(['accounting-deals'], (old) =>
        (old || []).map((d) =>
          d.application?.id === appId && d.application
            ? { ...d, application: { ...d.application, is_invoiced: value } }
            : d
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['accounting-deals'], ctx.prev);
      toast.error('Failed to update invoice status');
    },
    onSuccess: (_d, v) => {
      toast.success(v.value ? 'Marked as invoiced' : 'Reopened as pending');
    },
  });

  // Same finalized-deal definition as every other report (single source of truth).
  const finalizedDeals = useMemo(() => deals.filter(isFinalizedDeal), [deals]);

  const headerMetrics = useMemo(() => {
    let grossRevenue = 0;
    let netProfit = 0;
    finalizedDeals.forEach((d) => {
      grossRevenue += Number(d.sold_price || 0);
      netProfit += dealNetProfit(d);
    });
    return {
      grossRevenue,
      netProfit,
      dealCount: finalizedDeals.length,
    };
  }, [finalizedDeals]);

  const breakdown = useMemo(() => {
    if (!activeDeal) return null;
    const d = activeDeal;
    const app = d.application;
    const v = d.vehicle;
    const firstName = app?.first_name || (app?.full_name || '').split(' ')[0] || '';
    const lastName =
      app?.last_name || (app?.full_name || '').split(' ').slice(1).join(' ') || '';
    const clientName = `${firstName} ${lastName}`.trim() || app?.full_name || '—';
    const vehicleLabel = v
      ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—'
      : '—';
    const dateStr = d.sale_date
      ? format(new Date(d.sale_date), 'dd MMM yyyy')
      : format(new Date(d.created_at), 'dd MMM yyyy');
    const vapTotal = sumAddons(d.addons_data);
    const licensing = sumLicensing(d.aftersales_expenses);
    // The partner's PROFIT SHARE is the only partner figure deducted from profit.
    // Their CAPITAL contribution is returned to them (already inside the car's cost),
    // so it is shown for reference but never subtracted.
    const partnerProfitShare = Number(d.partner_profit_amount || 0);
    const partnerCapital = Number(d.partner_capital_contribution || 0);
    const referralPayout = Number(d.referral_commission_amount || 0);
    const grossSelling = Number(d.sold_price || 0);
    const dic = Number(d.dic_amount || 0);
    const vehicleCost = Number(d.cost_price || 0);
    const recon = Number(d.recon_cost || 0);
    // Canonical net profit stored at finalize — matches the Deal Ledger exactly.
    const netProfit = dealNetProfit(d);

    return {
      clientName,
      vehicleLabel,
      dateStr,
      vin: v?.vin || '—',
      reg: v?.registration_number || '—',
      make: v?.make || '—',
      model: v?.model || '—',
      year: v?.year ? String(v.year) : '—',
      idNumber: app?.id_number || '—',
      phone: app?.phone || '—',
      email: app?.email || '—',
      bankName: app?.contract_bank_name || '—',
      bankReference: app?.bank_reference || '—',
      grossSelling,
      vehicleCost,
      recon,
      licensing,
      dic,
      vapTotal,
      partnerProfitShare,
      partnerCapital,
      referralPayout,
      netProfit,
    };
  }, [activeDeal]);

  return (
    <div className="space-y-6">
      {/* === HEADER STATS === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Total Gross Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{fmtR(headerMetrics.grossRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sum of all finalized selling prices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-cyan-400" />
              Total Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              headerMetrics.netProfit >= 0 ? "text-cyan-400" : "text-red-400"
            )}>
              {fmtR(headerMetrics.netProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">After cost, recon, payouts & reg</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              Total Finalized Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-400">{headerMetrics.dealCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Delivered / finalized count</p>
          </CardContent>
        </Card>
      </div>

      {/* === LEDGER TABLE === */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Deals Breakdown</CardTitle>
            <CardDescription>
              Click any row to open the full financial breakdown for this deal
            </CardDescription>
          </div>
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {(['pending', 'all'] as const).map((v) => {
              const active = view === v;
              const label = v === 'pending' ? `Pending Invoices` : 'All Deals';
              const count =
                v === 'pending'
                  ? finalizedDeals.filter((d) => !d.application?.is_invoiced).length
                  : finalizedDeals.length;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const visibleDeals =
              view === 'pending'
                ? finalizedDeals.filter((d) => !d.application?.is_invoiced)
                : finalizedDeals;
            return (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold w-16">Invoiced</TableHead>
                      <TableHead className="font-semibold">Date Finalized</TableHead>
                      <TableHead className="font-semibold">Client</TableHead>
                      <TableHead className="font-semibold">Vehicle</TableHead>
                      <TableHead className="font-semibold text-right">Gross Selling</TableHead>
                      <TableHead className="font-semibold text-right">Net Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Loading deals…
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && visibleDeals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {view === 'pending'
                            ? 'No pending invoices — all clear.'
                            : 'No finalized deals yet.'}
                        </TableCell>
                      </TableRow>
                    )}
                    {visibleDeals.map((d) => {
                      const app = d.application;
                      const v = d.vehicle;
                      const firstName =
                        app?.first_name || (app?.full_name || '').split(' ')[0] || '';
                      const lastName =
                        app?.last_name ||
                        (app?.full_name || '').split(' ').slice(1).join(' ') ||
                        '';
                      const clientName = `${firstName} ${lastName}`.trim() || app?.full_name || '—';
                      const idNumber = app?.id_number || '—';
                      const dateStr = d.sale_date
                        ? format(new Date(d.sale_date), 'dd MMM yyyy')
                        : format(new Date(d.created_at), 'dd MMM yyyy');
                      const vehicleLabel = v
                        ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—'
                        : '—';
                      const netProfit = dealNetProfit(d);

                      return (
                        <TableRow
                          key={d.id}
                          onClick={() => setActiveDeal(d)}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-zinc-800/50',
                            d.application?.is_invoiced && 'opacity-50 text-zinc-500'
                          )}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={!!d.application?.is_invoiced}
                              disabled={!d.application?.id || toggleInvoiced.isPending}
                              onCheckedChange={(checked) => {
                                if (!d.application?.id) return;
                                toggleInvoiced.mutate({
                                  appId: d.application.id,
                                  value: checked === true,
                                });
                              }}
                              aria-label="Mark as invoiced"
                            />
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dateStr}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{clientName}</div>
                            <div className="text-xs text-muted-foreground">ID: {idNumber}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{vehicleLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {v?.registration_number || 'No reg'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-400">
                            {fmtR(Number(d.sold_price || 0))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-semibold tabular-nums",
                            netProfit >= 0 ? "text-cyan-400" : "text-red-400"
                          )}>
                            {fmtR(netProfit)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* === BREAKDOWN DRAWER === */}
      <Sheet open={!!activeDeal} onOpenChange={(open) => !open && setActiveDeal(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-200 overflow-y-auto"
        >
          {breakdown && (
            <>
              <SheetHeader className="space-y-1 pb-4 border-b border-zinc-800">
                <SheetTitle className="text-zinc-100 select-text">
                  {breakdown.clientName}
                </SheetTitle>
                <SheetDescription className="select-text text-zinc-400">
                  {breakdown.vehicleLabel}
                  <span className="block text-xs text-zinc-500 mt-0.5">
                    Finalized · {breakdown.dateStr}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-8 leading-relaxed">
                {/* SECTION 1: DEAL OVERVIEW */}
                <section>
                  <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-3">
                    Deal Overview
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <BreakdownItem label="Client Name" value={breakdown.clientName} />
                    <BreakdownItem label="ID Number" value={breakdown.idNumber} />
                    <BreakdownItem label="Phone" value={breakdown.phone} />
                    <BreakdownItem label="Email" value={breakdown.email} />
                    <BreakdownItem label="Bank / Finance House" value={breakdown.bankName} />
                    <BreakdownItem label="Bank Reference" value={breakdown.bankReference} />
                    <BreakdownItem label="Make" value={breakdown.make} />
                    <BreakdownItem label="Model" value={breakdown.model} />
                    <BreakdownItem label="Year" value={breakdown.year} />
                    <BreakdownItem label="VIN" value={breakdown.vin} />
                    <BreakdownItem
                      label="Registration"
                      value={breakdown.reg}
                      className="col-span-2"
                    />
                  </div>
                </section>

                {/* SECTION 2: INCOME & REVENUE */}
                <section>
                  <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-3">
                    Income & Revenue
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <BreakdownItem
                      label="Gross Selling Price"
                      value={fmtR(breakdown.grossSelling)}
                      tone="emerald"
                    />
                    <BreakdownItem
                      label="DIC (Dealer Incentive)"
                      value={fmtR(breakdown.dic)}
                      tone="cyan"
                    />
                    <BreakdownItem
                      label="VAP (Value Added Products)"
                      value={fmtR(breakdown.vapTotal)}
                      tone="purple"
                      className="col-span-2"
                    />
                  </div>
                </section>

                {/* SECTION 3: COSTS & DEDUCTIONS */}
                <section>
                  <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-3">
                    Costs & Deductions
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <BreakdownItem
                      label="Vehicle Purchase Cost"
                      value={fmtR(breakdown.vehicleCost)}
                    />
                    <BreakdownItem
                      label="Recon Total"
                      value={fmtR(breakdown.recon)}
                    />
                    <BreakdownItem
                      label="Licensing & Registration"
                      value={fmtR(breakdown.licensing)}
                    />
                    <BreakdownItem
                      label="Partner Profit Share"
                      value={fmtR(breakdown.partnerProfitShare)}
                      tone="red"
                    />
                    <BreakdownItem
                      label="Referral Payout"
                      value={fmtR(breakdown.referralPayout)}
                      tone="red"
                    />
                    {breakdown.partnerCapital > 0 && (
                      <BreakdownItem
                        label="Partner Capital (returned — not a cost)"
                        value={fmtR(breakdown.partnerCapital)}
                        className="col-span-2"
                      />
                    )}
                  </div>
                </section>

                {/* SECTION 4: PROFITABILITY */}
                <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400/80 mb-3">
                    Profitability
                  </h4>
                  <div className="flex items-start justify-between gap-6 select-text">
                    <span className="text-sm font-semibold text-zinc-200">
                      Total Deal Profit
                    </span>
                    <span className={cn(
                      "text-xl font-bold tabular-nums text-right",
                      breakdown.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {fmtR(breakdown.netProfit)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2 select-text">
                    Finalized net profit from the deal record — after vehicle cost, recon, all
                    expenses, licensing, referral and the partner profit share. Matches the Deal
                    Ledger to the cent. Partner capital is returned to the partner, not a cost.
                  </p>
                </section>

                <p className="text-[11px] text-zinc-600 italic pt-4 border-t border-zinc-800 select-text">
                  All text is selectable — click and drag to copy any value for your external invoice.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const BreakdownItem = ({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: 'emerald' | 'red' | 'purple' | 'cyan';
  className?: string;
}) => {
  const colorClass =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'red'
        ? 'text-red-400'
        : tone === 'purple'
          ? 'text-purple-400'
          : tone === 'cyan'
            ? 'text-cyan-400'
            : 'text-zinc-200';
  return (
    <div className={cn('flex flex-col gap-1 select-text', className)}>
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 select-text">
        {label}
      </span>
      <span className={cn('text-sm font-medium tabular-nums select-text break-words', colorClass)}>
        {value}
      </span>
    </div>
  );
};

export default AccountingVATTab;
