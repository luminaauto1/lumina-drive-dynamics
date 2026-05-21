import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Receipt, TrendingUp, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

const VAT_THRESHOLD = 1_000_000;

const fmtR = (val: number) =>
  `R ${Number(val || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;

interface AccountingDeal {
  id: string;
  application_id: string | null;
  sale_date: string | null;
  created_at: string;
  sold_price: number | null;
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
  } | null;
}

const useAccountingDeals = () => {
  return useQuery({
    queryKey: ['accounting-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select(`
          id, application_id, sale_date, created_at, sold_price, cost_price, recon_cost,
          dic_amount, partner_profit_amount, partner_capital_contribution,
          sales_rep_commission, referral_commission_amount,
          addons_data, aftersales_expenses, is_closed,
          vehicle:vehicles(make, model, year, vin, registration_number),
          application:finance_applications(
            id, first_name, last_name, full_name, id_number, phone, email,
            internal_status, status, is_invoiced
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

const addonsList = (addons: any[] | null) =>
  Array.isArray(addons) ? addons.map((a: any) => a?.name).filter(Boolean) : [];

// Heuristic to extract licensing/registration from aftersales_expenses
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

  const finalizedDeals = useMemo(() => {
    return deals.filter((d) => {
      const status = (d.application?.internal_status || d.application?.status || '').toLowerCase();
      return (
        d.is_closed ||
        status.includes('delivered') ||
        status.includes('finalized') ||
        status.includes('paid_out') ||
        status.includes('handover') ||
        !!d.sale_date
      );
    });
  }, [deals]);

  const headerMetrics = useMemo(() => {
    const oneYearAgo = subDays(new Date(), 365);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    let rolling12 = 0;
    let ytdVAP = 0;
    let ytdDIC = 0;

    finalizedDeals.forEach((d) => {
      const saleDate = d.sale_date ? new Date(d.sale_date) : new Date(d.created_at);
      const vatableSubtotal = Number(d.sold_price || 0);

      if (saleDate >= oneYearAgo) rolling12 += vatableSubtotal;
      if (saleDate >= yearStart) {
        ytdVAP += sumAddons(d.addons_data);
        ytdDIC += Number(d.dic_amount || 0);
      }
    });

    return {
      rolling12,
      ytdVAP,
      ytdDIC,
      pct: Math.min(100, (rolling12 / VAT_THRESHOLD) * 100),
    };
  }, [finalizedDeals]);

  // === Breakdown derived values for active deal ===
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
    const extras = addonsList(d.addons_data);
    const licensing = sumLicensing(d.aftersales_expenses);
    const partnerPayout =
      Number(d.partner_profit_amount || 0) + Number(d.partner_capital_contribution || 0);
    const referralPayout = Number(d.referral_commission_amount || 0);

    return {
      clientName,
      vehicleLabel,
      dateStr,
      vin: v?.vin || '—',
      reg: v?.registration_number || '—',
      idNumber: app?.id_number || '—',
      phone: app?.phone || '—',
      email: app?.email || '—',
      grossSelling: Number(d.sold_price || 0),
      vehicleCost: Number(d.cost_price || 0),
      licensing,
      dic: Number(d.dic_amount || 0),
      vapTotal,
      extras,
      partnerPayout,
      referralPayout,
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
              12-Month Rolling Turnover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{fmtR(headerMetrics.rolling12)}</p>
            <p className="text-xs text-muted-foreground mt-1">Vatable subtotal · last 365 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              VAT Threshold Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold">{headerMetrics.pct.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">of {fmtR(VAT_THRESHOLD)}</p>
            </div>
            <Progress value={headerMetrics.pct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {fmtR(Math.max(0, VAT_THRESHOLD - headerMetrics.rolling12))} remaining to SARS threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400" />
              YTD VAP / DIC Income
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">VAP</span>
              <span className="text-lg font-bold text-purple-400">{fmtR(headerMetrics.ytdVAP)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">DIC</span>
              <span className="text-lg font-bold text-cyan-400">{fmtR(headerMetrics.ytdDIC)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === LEDGER TABLE === */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Accounting Ledger</CardTitle>
            <CardDescription>
              Click any row to open the financial breakdown for external invoicing
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
                      <TableHead className="font-semibold w-16">Status</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Client</TableHead>
                      <TableHead className="font-semibold">Vehicle</TableHead>
                      <TableHead className="font-semibold text-right">Gross Revenue</TableHead>
                      <TableHead className="font-semibold text-right">VAP / Extras</TableHead>
                      <TableHead className="font-semibold text-right">Partner Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Loading ledger…
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && visibleDeals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                      const vapTotal = sumAddons(d.addons_data);
                      const partnerPayout =
                        Number(d.partner_profit_amount || 0) +
                        Number(d.partner_capital_contribution || 0);
                      const dateStr = d.sale_date
                        ? format(new Date(d.sale_date), 'dd MMM yyyy')
                        : format(new Date(d.created_at), 'dd MMM yyyy');
                      const vehicleLabel = v
                        ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—'
                        : '—';

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
                          <TableCell className="text-right text-purple-400">
                            {fmtR(vapTotal)}
                          </TableCell>
                          <TableCell className="text-right text-red-400 italic">
                            {partnerPayout > 0 ? `− ${fmtR(partnerPayout)}` : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground italic mt-3">
            Partner Payout shown in red is a Cost of Sale — it is <strong>not</strong> deducted
            from Gross Revenue and must be paid out separately.
          </p>
        </CardContent>
      </Card>

      {/* === BREAKDOWN DRAWER === */}
      <Sheet open={!!activeDeal} onOpenChange={(open) => !open && setActiveDeal(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-200 overflow-y-auto"
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

              <div className="mt-6 space-y-6 leading-relaxed">
                {/* Client Block */}
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
                    Client
                  </h4>
                  <dl className="space-y-2.5">
                    <BreakdownRow label="ID Number" value={breakdown.idNumber} />
                    <BreakdownRow label="Phone" value={breakdown.phone} />
                    <BreakdownRow label="Email" value={breakdown.email} />
                  </dl>
                </section>

                {/* Vehicle Block */}
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
                    Vehicle
                  </h4>
                  <dl className="space-y-2.5">
                    <BreakdownRow label="Description" value={breakdown.vehicleLabel} />
                    <BreakdownRow label="VIN" value={breakdown.vin} />
                    <BreakdownRow label="Registration" value={breakdown.reg} />
                  </dl>
                </section>

                {/* Financial Block */}
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
                    Financial Breakdown
                  </h4>
                  <dl className="space-y-3">
                    <BreakdownRow
                      label="Vehicle Total / Gross Selling Price"
                      value={fmtR(breakdown.grossSelling)}
                      emphasis="emerald"
                    />
                    <BreakdownRow label="Vehicle Cost" value={fmtR(breakdown.vehicleCost)} />
                    <BreakdownRow
                      label="Licensing & Registration (Disc)"
                      value={fmtR(breakdown.licensing)}
                    />
                    <BreakdownRow
                      label="DIC (Dealer Incentive Commission)"
                      value={fmtR(breakdown.dic)}
                      emphasis="cyan"
                    />
                    <BreakdownRow
                      label="VAP (Value Added Products)"
                      value={fmtR(breakdown.vapTotal)}
                      emphasis="purple"
                    />
                    {breakdown.extras.length > 0 && (
                      <div className="pl-3 border-l border-zinc-800 text-xs text-zinc-400 select-text">
                        {breakdown.extras.join(', ')}
                      </div>
                    )}
                    <BreakdownRow
                      label="Partner Payout"
                      value={fmtR(breakdown.partnerPayout)}
                      emphasis="red"
                    />
                    <BreakdownRow
                      label="Referral Payout"
                      value={fmtR(breakdown.referralPayout)}
                      emphasis="red"
                    />
                  </dl>
                </section>

                {/* Invoice Total Summary */}
                {(() => {
                  const invoiceTotal =
                    breakdown.grossSelling + breakdown.vapTotal + breakdown.licensing;
                  const exclVat = invoiceTotal / 1.15;
                  const vatAmount = invoiceTotal - exclVat;
                  return (
                    <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <h4 className="text-xs uppercase tracking-wider text-emerald-400/80 mb-3">
                        Invoice Total Summary
                      </h4>
                      <dl className="space-y-2.5">
                        <BreakdownRow
                          label="Vehicle"
                          value={fmtR(breakdown.grossSelling)}
                        />
                        <BreakdownRow
                          label="VAP / Extras"
                          value={fmtR(breakdown.vapTotal)}
                        />
                        <BreakdownRow
                          label="Licensing & Registration"
                          value={fmtR(breakdown.licensing)}
                        />
                        <div className="border-t border-emerald-500/20 pt-2.5 mt-1 space-y-2.5">
                          <BreakdownRow
                            label="Subtotal (excl. VAT)"
                            value={fmtR(exclVat)}
                          />
                          <BreakdownRow
                            label="VAT @ 15%"
                            value={fmtR(vatAmount)}
                          />
                          <div className="flex items-start justify-between gap-6 pt-2 border-t border-emerald-500/30 select-text">
                            <dt className="text-sm font-semibold text-zinc-200 select-text">
                              Invoice Total (incl. VAT)
                            </dt>
                            <dd className="text-base font-bold tabular-nums text-right text-emerald-400 select-text">
                              {fmtR(invoiceTotal)}
                            </dd>
                          </div>
                        </div>
                      </dl>
                    </section>
                  );
                })()}

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

const BreakdownRow = ({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'emerald' | 'red' | 'purple' | 'cyan';
}) => {
  const colorClass =
    emphasis === 'emerald'
      ? 'text-emerald-400'
      : emphasis === 'red'
        ? 'text-red-400'
        : emphasis === 'purple'
          ? 'text-purple-400'
          : emphasis === 'cyan'
            ? 'text-cyan-400'
            : 'text-zinc-200';
  return (
    <div className="flex items-start justify-between gap-6 py-1 select-text">
      <dt className="text-sm text-zinc-500 select-text">{label}</dt>
      <dd
        className={cn(
          'text-sm font-medium tabular-nums text-right select-text',
          colorClass
        )}
      >
        {value}
      </dd>
    </div>
  );
};

export default AccountingVATTab;
