import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Receipt, TrendingUp, CheckCircle2, Percent, Download, Truck, Banknote, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dealNetProfit, isFinalizedDeal } from '@/lib/dealMetrics';
import { useVendors, Vendor } from '@/hooks/useVendors';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { generateDealInvoicePDF, DealInvoiceData } from '@/lib/generateDealInvoicePDF';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

// To the cent — this is the accountant's view.
const fmtR = (val: number) =>
  `R ${Number(val || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  discount_amount: number | null;
  dealer_deposit_contribution: number | null;
  external_admin_fee: number | null;
  bank_initiation_fee: number | null;
  partner_profit_amount: number | null;
  partner_capital_contribution: number | null;
  sales_rep_commission: number | null;
  referral_commission_amount: number | null;
  referral_income_amount: number | null;
  addons_data: any[] | null;
  aftersales_expenses: any[] | null;
  is_closed: boolean | null;
  deal_type: string | null;
  finance_house_vendor_id: string | null;
  invoice_config: Record<string, any> | null;
  vehicle?: {
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    registration_number: string | null;
    source_vendor_id: string | null;
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
          dic_amount, discount_amount, dealer_deposit_contribution, external_admin_fee, bank_initiation_fee,
          partner_profit_amount, partner_capital_contribution,
          sales_rep_commission, referral_commission_amount, referral_income_amount,
          addons_data, aftersales_expenses, is_closed,
          deal_type, finance_house_vendor_id, invoice_config,
          vehicle:vehicles(make, model, year, vin, registration_number, source_vendor_id),
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

const num = (v: any) => Number(v || 0);
const sumAddons = (addons: any[] | null) =>
  Array.isArray(addons) ? addons.reduce((s, a) => s + num(a?.price), 0) : 0;
const sumAddonCost = (addons: any[] | null) =>
  Array.isArray(addons) ? addons.reduce((s, a) => s + num(a?.cost), 0) : 0;
const sumExpenses = (expenses: any[] | null) =>
  Array.isArray(expenses) ? expenses.reduce((s, e) => s + num(e?.amount ?? e?.price ?? e?.cost), 0) : 0;

const expenseLabel = (e: any) => String(e?.name || e?.description || e?.type || 'Expense');
const expenseAmount = (e: any) => num(e?.amount ?? e?.price ?? e?.cost);

// Build the invoice line items from what the operator ticked at finalize.
// Selling price is always included; everything else is opt-in per deal.
const buildInvoiceLines = (d: AccountingDeal): { description: string; amount: number }[] => {
  const cfg = d.invoice_config || {};
  const veh = d.vehicle;
  const vehLabel = veh ? `${veh.year || ''} ${veh.make || ''} ${veh.model || ''}`.trim() : 'Vehicle';
  const lines: { description: string; amount: number }[] = [
    { description: `${vehLabel}${veh?.vin ? ` (VIN ${veh.vin})` : ''} — selling price`, amount: num(d.sold_price) },
  ];
  if (cfg.dic && num(d.dic_amount) > 0) lines.push({ description: 'DIC (Dealer Incentive)', amount: num(d.dic_amount) });
  if (cfg.dealer_deposit && num(d.dealer_deposit_contribution) > 0) lines.push({ description: 'Dealer deposit contribution', amount: num(d.dealer_deposit_contribution) });
  if (cfg.admin_fee && num(d.external_admin_fee) > 0) lines.push({ description: 'Admin fee', amount: num(d.external_admin_fee) });
  if (cfg.bank_initiation_fee && num(d.bank_initiation_fee) > 0) lines.push({ description: 'Bank initiation fee', amount: num(d.bank_initiation_fee) });
  const includedAddons: string[] = Array.isArray(cfg.addons) ? cfg.addons : [];
  for (const a of Array.isArray(d.addons_data) ? d.addons_data : []) {
    if (a?.name && includedAddons.includes(a.name)) lines.push({ description: `${a.name} (VAP)`, amount: num(a.price) });
  }
  return lines;
};

const AccountingVATTab = () => {
  const { data: deals = [], isLoading } = useAccountingDeals();
  const { data: vendors = [] } = useVendors();
  const { data: docSettings } = useDocumentSettings();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [activeDeal, setActiveDeal] = useState<AccountingDeal | null>(null);

  const vendorMap = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  // VAT-registered only once a VAT number + positive rate are configured.
  const vatRegistered = !!(docSettings?.companyVatNumber?.trim()) && (docSettings?.vatPercent || 0) > 0;
  const vatRate = vatRegistered ? (docSettings?.vatPercent || 0) : 0;

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

  const finalizedDeals = useMemo(() => deals.filter(isFinalizedDeal), [deals]);

  const headerMetrics = useMemo(() => {
    let grossRevenue = 0;
    let netProfit = 0;
    finalizedDeals.forEach((d) => {
      grossRevenue += num(d.sold_price);
      netProfit += dealNetProfit(d);
    });
    // Output VAT is 0 while not registered; the embedded-portion calc switches on
    // automatically once a rate is configured.
    const outputVat = vatRate > 0
      ? finalizedDeals.reduce((s, d) => s + num(d.sold_price) * (vatRate / (100 + vatRate)), 0)
      : 0;
    return { grossRevenue, netProfit, dealCount: finalizedDeals.length, outputVat };
  }, [finalizedDeals, vatRate]);

  const breakdown = useMemo(() => {
    if (!activeDeal) return null;
    const d = activeDeal;
    const app = d.application;
    const v = d.vehicle;
    const firstName = app?.first_name || (app?.full_name || '').split(' ')[0] || '';
    const lastName = app?.last_name || (app?.full_name || '').split(' ').slice(1).join(' ') || '';
    const clientName = `${firstName} ${lastName}`.trim() || app?.full_name || '—';
    const vehicleLabel = v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—' : '—';
    const dateStr = d.sale_date
      ? format(new Date(d.sale_date), 'dd MMM yyyy')
      : format(new Date(d.created_at), 'dd MMM yyyy');

    const isFinance = d.deal_type === 'finance';
    const boughtFromVendor = v?.source_vendor_id ? vendorMap.get(v.source_vendor_id) : undefined;
    const financeVendor = d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;
    const soldToName = isFinance ? (financeVendor?.name || 'Finance house (not set)') : clientName;

    const addonItems = (Array.isArray(d.addons_data) ? d.addons_data : []).filter((a) => a?.name || a?.price);
    const expenseItems = (Array.isArray(d.aftersales_expenses) ? d.aftersales_expenses : []).filter((e) => expenseAmount(e) || expenseLabel(e));

    const invoiceLines = buildInvoiceLines(d);
    const invoiceTotal = invoiceLines.reduce((s, l) => s + l.amount, 0);

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
      isFinance,
      boughtFromVendor,
      financeVendor,
      soldToName,
      grossSelling: num(d.sold_price),
      discount: num(d.discount_amount),
      vehicleCost: num(d.cost_price),
      recon: num(d.recon_cost),
      dic: num(d.dic_amount),
      vapRevenue: sumAddons(d.addons_data),
      vapCost: sumAddonCost(d.addons_data),
      referralIncome: num(d.referral_income_amount),
      referralPayout: num(d.referral_commission_amount),
      commission: num(d.sales_rep_commission),
      partnerProfitShare: num(d.partner_profit_amount),
      partnerCapital: num(d.partner_capital_contribution),
      dealerDeposit: num(d.dealer_deposit_contribution),
      adminFee: num(d.external_admin_fee),
      bankInitFee: num(d.bank_initiation_fee),
      expensesTotal: sumExpenses(d.aftersales_expenses),
      addonItems,
      expenseItems,
      invoiceLines,
      invoiceTotal,
      netProfit: dealNetProfit(d),
    };
  }, [activeDeal, vendorMap]);

  const handleDownloadInvoice = (d: AccountingDeal) => {
    if (!docSettings) { toast.error('Document settings not loaded yet'); return; }
    const app = d.application;
    const v = d.vehicle;
    const clientName = `${app?.first_name || ''} ${app?.last_name || ''}`.trim() || app?.full_name || 'Client';
    const isFinance = d.deal_type === 'finance';
    const financeVendor = d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;

    if (isFinance && !financeVendor) {
      toast.error('This is a finance deal but no finance house is set — open the deal and pick one first.');
      return;
    }

    const billTo = isFinance && financeVendor
      ? {
          name: financeVendor.name,
          regOrId: financeVendor.registration_number ? `Reg: ${financeVendor.registration_number}` : undefined,
          vatNumber: financeVendor.vat_number || undefined,
          address: financeVendor.address || undefined,
          email: financeVendor.email || undefined,
          phone: financeVendor.phone || undefined,
        }
      : {
          name: clientName,
          regOrId: app?.id_number ? `ID: ${app.id_number}` : undefined,
          email: app?.email || undefined,
          phone: app?.phone || undefined,
        };

    const data: DealInvoiceData = {
      invoiceNumber: `${docSettings.invoicePrefix || 'INV-'}${d.id.slice(0, 8).toUpperCase()}`,
      date: d.sale_date ? format(new Date(d.sale_date), 'dd MMM yyyy') : format(new Date(d.created_at), 'dd MMM yyyy'),
      billTo,
      onBehalfOf: isFinance ? clientName : undefined,
      vehicleLabel: v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() : undefined,
      vin: v?.vin || undefined,
      reg: v?.registration_number || undefined,
      lineItems: buildInvoiceLines(d),
    };
    generateDealInvoicePDF(data, docSettings);
  };

  return (
    <div className="space-y-6">
      {/* === HEADER STATS === */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <p className={cn("text-2xl font-bold", headerMetrics.netProfit >= 0 ? "text-cyan-400" : "text-red-400")}>
              {fmtR(headerMetrics.netProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">After cost, recon, payouts & reg</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-400" />
              Output VAT ({vatRate}%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400">{fmtR(headerMetrics.outputVat)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {vatRegistered ? 'Embedded VAT on sales' : 'Not VAT registered yet'}
            </p>
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
            <CardDescription>Click any row to open the full financial breakdown for this deal</CardDescription>
          </div>
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {(['pending', 'all'] as const).map((vw) => {
              const active = view === vw;
              const label = vw === 'pending' ? `Pending Invoices` : 'All Deals';
              const count =
                vw === 'pending'
                  ? finalizedDeals.filter((d) => !d.application?.is_invoiced).length
                  : finalizedDeals.length;
              return (
                <button
                  key={vw}
                  onClick={() => setView(vw)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors',
                    active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
                      <TableHead className="font-semibold">Sold To</TableHead>
                      <TableHead className="font-semibold text-right">Gross Selling</TableHead>
                      <TableHead className="font-semibold text-right">Net Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading deals…</TableCell></TableRow>
                    )}
                    {!isLoading && visibleDeals.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {view === 'pending' ? 'No pending invoices — all clear.' : 'No finalized deals yet.'}
                      </TableCell></TableRow>
                    )}
                    {visibleDeals.map((d) => {
                      const app = d.application;
                      const v = d.vehicle;
                      const firstName = app?.first_name || (app?.full_name || '').split(' ')[0] || '';
                      const lastName = app?.last_name || (app?.full_name || '').split(' ').slice(1).join(' ') || '';
                      const clientName = `${firstName} ${lastName}`.trim() || app?.full_name || '—';
                      const idNumber = app?.id_number || '—';
                      const dateStr = d.sale_date
                        ? format(new Date(d.sale_date), 'dd MMM yyyy')
                        : format(new Date(d.created_at), 'dd MMM yyyy');
                      const vehicleLabel = v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—' : '—';
                      const isFinance = d.deal_type === 'finance';
                      const financeVendor = d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;
                      const netProfit = dealNetProfit(d);

                      return (
                        <TableRow
                          key={d.id}
                          onClick={() => setActiveDeal(d)}
                          className={cn('cursor-pointer transition-colors hover:bg-zinc-800/50', d.application?.is_invoiced && 'opacity-50 text-zinc-500')}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={!!d.application?.is_invoiced}
                              disabled={!d.application?.id || toggleInvoiced.isPending}
                              onCheckedChange={(checked) => {
                                if (!d.application?.id) return;
                                toggleInvoiced.mutate({ appId: d.application.id, value: checked === true });
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
                            <div className="text-xs text-muted-foreground">{v?.registration_number || 'No reg'}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {isFinance ? (
                              <span className="inline-flex items-center gap-1 text-purple-400">
                                <Banknote className="w-3 h-3" />{financeVendor?.name || 'Finance (not set)'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Customer (direct)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-400">{fmtR(num(d.sold_price))}</TableCell>
                          <TableCell className={cn("text-right font-semibold tabular-nums", netProfit >= 0 ? "text-cyan-400" : "text-red-400")}>
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
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-200 overflow-y-auto">
          {breakdown && activeDeal && (
            <>
              <SheetHeader className="space-y-1 pb-4 border-b border-zinc-800">
                <SheetTitle className="text-zinc-100 select-text">{breakdown.clientName}</SheetTitle>
                <SheetDescription className="select-text text-zinc-400">
                  {breakdown.vehicleLabel}
                  <span className="block text-xs text-zinc-500 mt-0.5">Finalized · {breakdown.dateStr}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-8 leading-relaxed">
                {/* PARTIES: bought from -> sold to */}
                <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="select-text">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1"><Truck className="w-3 h-3" /> Bought From</div>
                      <div className="text-sm font-medium text-zinc-200 mt-1">{breakdown.boughtFromVendor?.name || '— not set —'}</div>
                      <div className="text-xs text-zinc-500">Purchase {fmtR(breakdown.vehicleCost)}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                    <div className="text-right select-text">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center justify-end gap-1">
                        {breakdown.isFinance ? <Banknote className="w-3 h-3" /> : null} Sold To
                      </div>
                      <div className="text-sm font-medium text-zinc-200 mt-1">{breakdown.soldToName}</div>
                      <div className="text-xs text-zinc-500">
                        {breakdown.isFinance ? `Finance — on behalf of ${breakdown.clientName}` : 'Direct to customer'}
                      </div>
                    </div>
                  </div>
                </section>

                {/* DEAL OVERVIEW */}
                <Section title="Deal Overview">
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
                    <BreakdownItem label="Registration" value={breakdown.reg} className="col-span-2" />
                  </div>
                </Section>

                {/* INCOME & REVENUE */}
                <Section title="Income & Revenue">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <BreakdownItem label="Gross Selling Price" value={fmtR(breakdown.grossSelling)} tone="emerald" />
                    {breakdown.discount > 0 && <BreakdownItem label="Discount Given" value={`- ${fmtR(breakdown.discount)}`} tone="red" />}
                    <BreakdownItem label="DIC (Dealer Incentive)" value={fmtR(breakdown.dic)} tone="cyan" />
                    <BreakdownItem label="VAP Revenue" value={fmtR(breakdown.vapRevenue)} tone="purple" />
                    <BreakdownItem label="Referral Income" value={fmtR(breakdown.referralIncome)} tone="cyan" />
                  </div>
                </Section>

                {/* COSTS & DEDUCTIONS */}
                <Section title="Costs & Deductions">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <BreakdownItem label="Vehicle Purchase Cost" value={fmtR(breakdown.vehicleCost)} />
                    <BreakdownItem label="Recon Total" value={fmtR(breakdown.recon)} />
                    <BreakdownItem label="VAP Cost" value={fmtR(breakdown.vapCost)} />
                    <BreakdownItem label="Sales-Rep Commission" value={fmtR(breakdown.commission)} tone="red" />
                    <BreakdownItem label="Partner Profit Share" value={fmtR(breakdown.partnerProfitShare)} tone="red" />
                    <BreakdownItem label="Referral Payout" value={fmtR(breakdown.referralPayout)} tone="red" />
                    {breakdown.partnerCapital > 0 && (
                      <BreakdownItem label="Partner Capital (returned — not a cost)" value={fmtR(breakdown.partnerCapital)} className="col-span-2" />
                    )}
                  </div>
                </Section>

                {/* ITEMIZED EXPENSES */}
                {breakdown.expenseItems.length > 0 && (
                  <Section title={`Aftersales / Expenses (${breakdown.expenseItems.length})`}>
                    <ul className="space-y-1.5">
                      {breakdown.expenseItems.map((e, i) => (
                        <li key={i} className="flex justify-between text-sm select-text">
                          <span className="text-zinc-300">{expenseLabel(e)}</span>
                          <span className="tabular-nums text-zinc-200">{fmtR(expenseAmount(e))}</span>
                        </li>
                      ))}
                      <li className="flex justify-between text-sm font-semibold border-t border-zinc-800 pt-1.5 mt-1.5">
                        <span>Total expenses</span><span className="tabular-nums">{fmtR(breakdown.expensesTotal)}</span>
                      </li>
                    </ul>
                  </Section>
                )}

                {/* ITEMIZED VAPs */}
                {breakdown.addonItems.length > 0 && (
                  <Section title={`Value-Added Products (${breakdown.addonItems.length})`}>
                    <ul className="space-y-1.5">
                      {breakdown.addonItems.map((a, i) => (
                        <li key={i} className="flex justify-between text-sm select-text">
                          <span className="text-zinc-300">{a.name || 'VAP'}</span>
                          <span className="tabular-nums text-zinc-400">
                            cost {fmtR(num(a.cost))} → sell <span className="text-zinc-200">{fmtR(num(a.price))}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* VAT */}
                <Section title="VAT">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <BreakdownItem label="VAT Status" value={vatRegistered ? `Registered (${vatRate}%)` : 'Not registered'} />
                    <BreakdownItem
                      label={`Output VAT (${vatRate}%)`}
                      value={fmtR(vatRate > 0 ? breakdown.grossSelling * (vatRate / (100 + vatRate)) : 0)}
                      tone="amber"
                    />
                  </div>
                  {!vatRegistered && (
                    <p className="text-[11px] text-zinc-500 mt-2">No VAT is charged. This flips on automatically once a VAT number + rate are set in Document Settings.</p>
                  )}
                </Section>

                {/* PROFITABILITY */}
                <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400/80 mb-3">Profitability</h4>
                  <div className="flex items-start justify-between gap-6 select-text">
                    <span className="text-sm font-semibold text-zinc-200">Total Deal Profit</span>
                    <span className={cn("text-xl font-bold tabular-nums text-right", breakdown.netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmtR(breakdown.netProfit)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2 select-text">
                    Finalized net profit from the deal record — matches the Deal Ledger to the cent. Partner capital is returned, not a cost.
                  </p>
                </section>

                {/* INVOICE */}
                <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400">Invoice</h4>
                      <p className="text-sm text-zinc-200 mt-1">
                        Bill to: <span className="font-medium">{breakdown.soldToName}</span>
                        {breakdown.isFinance && <span className="text-zinc-500"> · on behalf of {breakdown.clientName}</span>}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleDownloadInvoice(activeDeal)}>
                      <Download className="w-4 h-4 mr-1" /> {vatRegistered ? 'Tax Invoice' : 'Invoice'} PDF
                    </Button>
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
                    {breakdown.invoiceLines.map((l, i) => (
                      <li key={i} className="flex justify-between text-sm select-text">
                        <span className="text-zinc-300">{l.description}</span>
                        <span className="tabular-nums text-zinc-200">{fmtR(l.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between text-sm font-semibold border-t border-zinc-800 pt-1.5 mt-1.5">
                      <span>Invoice total</span><span className="tabular-nums">{fmtR(breakdown.invoiceTotal)}</span>
                    </li>
                  </ul>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Lines come from the "include on invoice" tickboxes set when finalizing the deal.
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-3">{title}</h4>
    {children}
  </section>
);

const BreakdownItem = ({
  label, value, tone, className,
}: {
  label: string;
  value: string;
  tone?: 'emerald' | 'red' | 'purple' | 'cyan' | 'amber';
  className?: string;
}) => {
  const colorClass =
    tone === 'emerald' ? 'text-emerald-400'
    : tone === 'red' ? 'text-red-400'
    : tone === 'purple' ? 'text-purple-400'
    : tone === 'cyan' ? 'text-cyan-400'
    : tone === 'amber' ? 'text-amber-400'
    : 'text-zinc-200';
  return (
    <div className={cn('flex flex-col gap-1 select-text', className)}>
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 select-text">{label}</span>
      <span className={cn('text-sm font-medium tabular-nums select-text break-words', colorClass)}>{value}</span>
    </div>
  );
};

export default AccountingVATTab;
