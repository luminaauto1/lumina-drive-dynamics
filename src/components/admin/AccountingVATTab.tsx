import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Receipt, TrendingUp, CheckCircle2, Percent, Download, Truck, Banknote, ArrowRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dealNetProfit, isFinalizedDeal } from '@/lib/dealMetrics';
import { useVendors, Vendor } from '@/hooks/useVendors';
import { useVehicleExpenses, EXPENSE_CATEGORIES } from '@/hooks/useVehicleExpenses';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { generateVehicleSpecPDF, loadVehicleImage, SpecSection } from '@/lib/generateVehicleSpecPDF';
import { InvoicePrintPreview } from '@/features/invoice/InvoicePrintPreview';
import { InvoicePayload, EMPTY_PARTY } from '@/features/invoice/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

// To the cent — this is the accountant's view.
const fmtR = (val: number) =>
  `R ${Number(val || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: any) => Number(v || 0);

interface AccountingDeal {
  id: string;
  application_id: string | null;
  vehicle_id: string | null;
  sale_date: string | null;
  created_at: string;
  sold_price: number | null;
  gross_profit: number | null;
  cost_price: number | null;
  recon_cost: number | null;
  dic_amount: number | null;
  discount_amount: number | null;
  client_deposit: number | null;
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
    variant: string | null;
    year: number | null;
    vin: string | null;
    engine_code: string | null;
    registration_number: string | null;
    stock_number: string | null;
    mileage: number | null;
    color: string | null;
    transmission: string | null;
    fuel_type: string | null;
    images: string[] | null;
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
          id, application_id, vehicle_id, sale_date, created_at, sold_price, gross_profit, cost_price, recon_cost,
          dic_amount, discount_amount, client_deposit, dealer_deposit_contribution, external_admin_fee, bank_initiation_fee,
          partner_profit_amount, partner_capital_contribution,
          sales_rep_commission, referral_commission_amount, referral_income_amount,
          addons_data, aftersales_expenses, is_closed,
          deal_type, finance_house_vendor_id, invoice_config,
          vehicle:vehicles(make, model, variant, year, vin, engine_code, registration_number, stock_number, mileage, color, transmission, fuel_type, images, source_vendor_id),
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

const sumAddons = (a: any[] | null) => (Array.isArray(a) ? a.reduce((s, x) => s + num(x?.price), 0) : 0);
const sumAddonCost = (a: any[] | null) => (Array.isArray(a) ? a.reduce((s, x) => s + num(x?.cost), 0) : 0);
const sumExpenses = (e: any[] | null) => (Array.isArray(e) ? e.reduce((s, x) => s + num(x?.amount ?? x?.price ?? x?.cost), 0) : 0);
const expenseLabel = (e: any) => String(e?.name || e?.description || e?.type || 'Expense');
const expenseAmount = (e: any) => num(e?.amount ?? e?.price ?? e?.cost);
const catLabel = (c: string) => EXPENSE_CATEGORIES.find((x) => x.value === c)?.label || c || 'General';

// Invoice line items come from the operator's finalize-time tickboxes.
const buildInvoiceLines = (d: AccountingDeal): { description: string; amount: number }[] => {
  const cfg = d.invoice_config || {};
  const veh = d.vehicle;
  const vehLabel = veh ? `${veh.year || ''} ${veh.make || ''} ${veh.model || ''}`.trim() : 'Vehicle';
  const lines: { description: string; amount: number }[] = [];
  // What the buyer actually pays us for the car:
  //  - Direct sale: the full selling price.
  //  - Finance deal: the finance house funds the purchase (keeps the bought price)
  //    and pays us the proceeds ON TOP — i.e. selling price minus the vehicle cost.
  const isFinance = d.deal_type === 'finance';
  // Finance deals vary per deal: sometimes the house FUNDS the car (keeps the
  // bought price) and pays us only the margin; other times WE own the car and they
  // buy it from us at the full price. invoice_config.finance_basis chooses
  // ('full' | 'margin'); default is 'full'.
  const useMargin = isFinance && cfg.finance_basis === 'margin';
  const vinPart = veh?.vin ? ` (VIN ${veh.vin})` : '';
  const vehicleAmount = useMargin ? (num(d.sold_price) - num(d.cost_price)) : num(d.sold_price);
  const vehicleDesc = useMargin
    ? `${vehLabel}${vinPart} — deal proceeds (selling less purchase)`
    : `${vehLabel}${vinPart} — selling price`;
  if (cfg.selling_price !== false) lines.push({ description: vehicleDesc, amount: vehicleAmount });
  if (cfg.dic && num(d.dic_amount) > 0) lines.push({ description: 'DIC (Dealer Incentive)', amount: num(d.dic_amount) });
  if (cfg.dealer_deposit && num(d.dealer_deposit_contribution) > 0) lines.push({ description: 'Dealer deposit contribution', amount: num(d.dealer_deposit_contribution) });
  if (cfg.admin_fee && num(d.external_admin_fee) > 0) lines.push({ description: 'Admin fee', amount: num(d.external_admin_fee) });
  if (cfg.bank_initiation_fee && num(d.bank_initiation_fee) > 0) lines.push({ description: 'Bank initiation fee', amount: num(d.bank_initiation_fee) });
  const inc: string[] = Array.isArray(cfg.addons) ? cfg.addons : [];
  for (const a of Array.isArray(d.addons_data) ? d.addons_data : []) {
    if (a?.name && inc.includes(a.name)) lines.push({ description: `${a.name} (VAP)`, amount: num(a.price) });
  }
  // Custom lines (e.g. "Profit on deal" / "Facilitation fee" billed to a finance house).
  for (const cl of Array.isArray(cfg.custom_lines) ? cfg.custom_lines : []) {
    if (cl && (cl.label || num(cl.amount))) lines.push({ description: String(cl.label || 'Other'), amount: num(cl.amount) });
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
  const [specBusy, setSpecBusy] = useState(false);
  // Full-screen invoice document preview (obsidian A4, shared with /admin/invoices).
  const [invoicePreview, setInvoicePreview] = useState<InvoicePayload | null>(null);

  // Per-vehicle expense ledger (the individual recon/expense line items).
  const { data: vehicleExpenses = [] } = useVehicleExpenses(activeDeal?.vehicle_id || undefined);
  const reconLedgerTotal = useMemo(() => vehicleExpenses.reduce((s, e) => s + num(e.amount), 0), [vehicleExpenses]);

  const vendorMap = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  const vatRegistered = docSettings?.vatRegistered ?? (!!(docSettings?.companyVatNumber?.trim()) && (docSettings?.vatPercent || 0) > 0);
  const vatRate = vatRegistered ? (docSettings?.vatPercent || 0) : 0;

  const toggleInvoiced = useMutation({
    mutationFn: async ({ appId, value }: { appId: string; value: boolean }) => {
      const { error } = await supabase.from('finance_applications').update({ is_invoiced: value }).eq('id', appId);
      if (error) throw error;
    },
    onMutate: async ({ appId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['accounting-deals'] });
      const prev = queryClient.getQueryData<AccountingDeal[]>(['accounting-deals']);
      queryClient.setQueryData<AccountingDeal[]>(['accounting-deals'], (old) =>
        (old || []).map((d) => d.application?.id === appId && d.application ? { ...d, application: { ...d.application, is_invoiced: value } } : d)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['accounting-deals'], ctx.prev); toast.error('Failed to update invoice status'); },
    onSuccess: (_d, v) => toast.success(v.value ? 'Marked as invoiced' : 'Reopened as pending'),
  });

  const finalizedDeals = useMemo(() => deals.filter(isFinalizedDeal), [deals]);

  const headerMetrics = useMemo(() => {
    let grossRevenue = 0, netProfit = 0;
    finalizedDeals.forEach((d) => { grossRevenue += num(d.sold_price); netProfit += dealNetProfit(d); });
    const outputVat = vatRate > 0 ? finalizedDeals.reduce((s, d) => s + num(d.sold_price) * (vatRate / (100 + vatRate)), 0) : 0;
    return { grossRevenue, netProfit, dealCount: finalizedDeals.length, outputVat };
  }, [finalizedDeals, vatRate]);

  const b = useMemo(() => {
    if (!activeDeal) return null;
    const d = activeDeal;
    const app = d.application;
    const v = d.vehicle;
    const firstName = app?.first_name || (app?.full_name || '').split(' ')[0] || '';
    const lastName = app?.last_name || (app?.full_name || '').split(' ').slice(1).join(' ') || '';
    const clientName = `${firstName} ${lastName}`.trim() || app?.full_name || '—';
    const vehicleLabel = v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—' : '—';
    const isFinance = d.deal_type === 'finance';
    const financeVendor = d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;
    const invoiceLines = buildInvoiceLines(d);
    return {
      d, app, v, clientName, vehicleLabel, isFinance, financeVendor,
      dateStr: d.sale_date ? format(new Date(d.sale_date), 'dd MMM yyyy') : format(new Date(d.created_at), 'dd MMM yyyy'),
      boughtFromVendor: v?.source_vendor_id ? vendorMap.get(v.source_vendor_id) : undefined,
      soldToName: isFinance ? (financeVendor?.name || 'Finance house (not set)') : clientName,
      financeBasis: (d.invoice_config?.finance_basis === 'margin' ? 'margin' : 'full') as 'full' | 'margin',
      grossSelling: num(d.sold_price), discount: num(d.discount_amount), vehicleCost: num(d.cost_price),
      recon: num(d.recon_cost), dic: num(d.dic_amount), vapRevenue: sumAddons(d.addons_data), vapCost: sumAddonCost(d.addons_data),
      referralIncome: num(d.referral_income_amount), referralPayout: num(d.referral_commission_amount),
      commission: num(d.sales_rep_commission), partnerProfitShare: num(d.partner_profit_amount), partnerCapital: num(d.partner_capital_contribution),
      addonItems: (Array.isArray(d.addons_data) ? d.addons_data : []).filter((a) => a?.name || a?.price),
      expenseItems: (Array.isArray(d.aftersales_expenses) ? d.aftersales_expenses : []).filter((e) => expenseAmount(e) || expenseLabel(e)),
      expensesTotal: sumExpenses(d.aftersales_expenses),
      invoiceLines, invoiceTotal: invoiceLines.reduce((s, l) => s + l.amount, 0),
      netProfit: dealNetProfit(d),
    };
  }, [activeDeal, vendorMap]);

  // A deal's invoice is a TAX INVOICE when our company is VAT-registered, or the
  // finance house it's billed to is VAT-registered (then it's zero-rated while we're not).
  const isTaxInvoiceForDeal = (d: AccountingDeal): boolean => {
    if (docSettings?.vatRegistered) return true;
    const fv = d.deal_type === 'finance' && d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;
    return !!fv?.is_vat_registered;
  };

  const handleDownloadInvoice = (d: AccountingDeal) => {
    if (!docSettings) { toast.error('Document settings not loaded yet'); return; }
    const app = d.application; const v = d.vehicle;
    const clientName = `${app?.first_name || ''} ${app?.last_name || ''}`.trim() || app?.full_name || 'Client';
    const isFinance = d.deal_type === 'finance';
    const financeVendor = d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;
    if (isFinance && !financeVendor) { toast.error('Finance deal but no finance house set — open the deal and pick one first.'); return; }
    const taxInvoice = isTaxInvoiceForDeal(d);
    const billTo = isFinance && financeVendor
      ? { name: financeVendor.name, regOrId: financeVendor.registration_number ? `Reg: ${financeVendor.registration_number}` : undefined, vatNumber: financeVendor.vat_number || undefined, address: financeVendor.address || undefined, email: financeVendor.email || undefined, phone: financeVendor.phone || undefined }
      : { name: clientName, regOrId: app?.id_number ? `ID: ${app.id_number}` : undefined, email: app?.email || undefined, phone: app?.phone || undefined };
    const cfg = d.invoice_config || {};
    const invoiceNumber = (cfg.invoice_number && String(cfg.invoice_number).trim())
      || `${docSettings.invoicePrefix || 'INV-'}${d.id.slice(0, 8).toUpperCase()}`;
    // Motor-trade document: vehicle SOLD FOR row + remaining ticked lines as
    // misc items. Same numbers as the ticked lines total — rendered by the
    // shared InvoiceDocument (obsidian A4, same family as Quote/OTP).
    const lines = buildInvoiceLines(d);
    const includeVehicle = cfg.selling_price !== false;
    const useMargin = isFinance && cfg.finance_basis === 'margin';
    const vehicleAmount = useMargin ? (num(d.sold_price) - num(d.cost_price)) : num(d.sold_price);
    // The vehicle line is always FIRST when included — the rest become misc items.
    const miscLines = includeVehicle ? lines.slice(1) : lines;
    const vehLabel = v ? [v.year, v.make, v.model, v.variant].filter(Boolean).join(' ').trim() : 'Vehicle';

    const payload: InvoicePayload = {
      v: 1,
      mode: 'vehicle',
      invoiceNumber,
      paymentReference: (cfg.payment_reference && String(cfg.payment_reference).trim()) || '',
      dateStr: String(d.sale_date || d.created_at).slice(0, 10),
      taxInvoice,
      billTo: {
        ...EMPTY_PARTY,
        name: billTo.name || '',
        regOrId: billTo.regOrId || '',
        vatNumber: (billTo as any).vatNumber || '',
        address: (billTo as any).address || '',
        email: billTo.email || '',
        phone: billTo.phone || '',
      },
      deliveredToEnabled: isFinance,
      deliveredTo: {
        ...EMPTY_PARTY,
        name: isFinance ? clientName : '',
        regOrId: isFinance && app?.id_number ? `ID: ${app.id_number}` : '',
        email: (isFinance && app?.email) || '',
        phone: (isFinance && app?.phone) || '',
      },
      vehicle: {
        make: v?.make || '', model: v?.model || '', variant: v?.variant || '',
        year: v?.year != null ? String(v.year) : '', yearFirstReg: '',
        colour: v?.color || '', km: v?.mileage != null ? String(v.mileage) : '',
        mmCode: '', vin: v?.vin || '', engineNo: v?.engine_code || '',
        regNo: v?.registration_number || '', stockNo: v?.stock_number || '',
        features: [v?.transmission, v?.fuel_type].filter(Boolean).join(', '),
        dateSold: String(d.sale_date || d.created_at).slice(0, 10),
        salesperson: '',
      },
      soldForIncl: includeVehicle ? vehicleAmount : 0,
      soldForLabel: includeVehicle && useMargin
        ? `${vehLabel} — deal proceeds (selling less purchase)`
        : undefined,
      miscItems: miscLines.map((l) => ({ description: l.description, amountIncl: l.amount, vatExempt: false })),
      // Deposit only reduces the payable on DIRECT client invoices. A finance
      // house owes the dealer the full billed amount — the client's deposit is
      // settled on the bank's side, so it must not shrink PRINCIPAL DEBT here.
      depositPaid: isFinance ? 0 : num(d.client_deposit),
      tradeInDeposit: 0,
      generalItems: [],
      notes: '',
    };
    setInvoicePreview(payload);
  };

  // Full spec sheet + sale breakdown for the open (sold) deal.
  const downloadSpec = async (d: AccountingDeal) => {
    if (!docSettings || !b) { toast.error('Not ready yet'); return; }
    setSpecBusy(true);
    try {
      const v = d.vehicle;
      const photos = (await Promise.all((v?.images || []).slice(0, 2).map((u) => loadVehicleImage(u)))).filter(Boolean) as any[];
      const vehicleRows = ([
        ['Make', v?.make], ['Model', v?.model], ['Variant', v?.variant], ['Year', v?.year], ['Colour', v?.color],
        ['Mileage', v?.mileage != null ? `${Number(v.mileage).toLocaleString('en-ZA')} km` : ''],
        ['Transmission', v?.transmission], ['Fuel', v?.fuel_type], ['VIN', v?.vin], ['Engine No', v?.engine_code],
        ['Registration', v?.registration_number], ['Stock No', v?.stock_number],
      ] as [string, any][])
        .filter(([, val]) => val != null && String(val).trim() !== '')
        .map(([label, val]) => ({ label, value: String(val) }));

      // Itemised recon ledger (the individual vehicle_expenses lines) + any extra deal recon.
      const ledgerTotal = vehicleExpenses.reduce((s, e) => s + num(e.amount), 0);
      const addRecon = b.recon - ledgerTotal;
      const reconItemRows = vehicleExpenses.map((e: any) => ({
        label: `${e.description || catLabel(e.category)} · ${catLabel(e.category)}`,
        value: fmtR(num(e.amount)),
      }));
      if (addRecon > 0.005) reconItemRows.push({ label: 'Additional deal recon (not on ledger)', value: fmtR(addRecon) });

      const sections: SpecSection[] = [
        { title: 'Parties', rows: [
          { label: 'Bought from', value: b.boughtFromVendor?.name || '—' },
          { label: 'Sold to', value: b.soldToName + (b.isFinance ? ` (for ${b.clientName})` : '') },
        ] },
        { title: 'Income', rows: [
          { label: 'Gross selling price', value: fmtR(b.grossSelling) },
          ...(b.discount > 0 ? [{ label: 'Discount', value: `- ${fmtR(b.discount)}` }] : []),
          { label: 'DIC', value: fmtR(b.dic) },
          { label: 'VAP revenue', value: fmtR(b.vapRevenue) },
          { label: 'Referral income', value: fmtR(b.referralIncome) },
        ] },
        { title: 'Costs & deductions', rows: [
          { label: 'Vehicle purchase', value: fmtR(b.vehicleCost) },
          { label: 'Recon total', value: fmtR(b.recon) },
          { label: 'VAP cost', value: fmtR(b.vapCost) },
          { label: 'Aftersales expenses', value: fmtR(b.expensesTotal) },
          { label: 'Sales-rep commission', value: fmtR(b.commission) },
          { label: 'Partner profit share', value: fmtR(b.partnerProfitShare) },
          { label: 'Referral payout', value: fmtR(b.referralPayout) },
          ...(b.partnerCapital > 0 ? [{ label: 'Partner capital (returned)', value: fmtR(b.partnerCapital) }] : []),
        ] },
        ...(reconItemRows.length ? [{ title: `Recon / vehicle expense items (${reconItemRows.length})`, rows: reconItemRows }] : []),
        ...(b.expenseItems.length ? [{ title: `Aftersales / expense items (${b.expenseItems.length})`, rows: b.expenseItems.map((e: any) => ({ label: expenseLabel(e), value: fmtR(expenseAmount(e)) })) }] : []),
        ...(b.addonItems.length ? [{ title: 'Value-added products', rows: b.addonItems.map((a: any) => ({ label: a.name || 'VAP', value: `cost ${fmtR(num(a.cost))} → sell ${fmtR(num(a.price))}` })) }] : []),
        { title: 'VAT', rows: [
          { label: 'Status', value: vatRegistered ? `Registered (${vatRate}%)` : 'Not registered' },
          { label: `Output VAT (${vatRate}%)`, value: fmtR(vatRate > 0 ? b.grossSelling * (vatRate / (100 + vatRate)) : 0) },
        ] },
        { title: 'Net profit', emphasize: true, rows: [{ label: 'Total deal profit', value: fmtR(b.netProfit) }] },
      ];

      generateVehicleSpecPDF({
        title: 'SALE BREAKDOWN',
        subtitle: b.vehicleLabel,
        ref: `${docSettings.invoicePrefix || 'INV-'}${d.id.slice(0, 8).toUpperCase()}`,
        date: b.dateStr,
        vehicleRows, photos, sections,
      }, docSettings);
      toast.success('Spec sheet generated');
    } catch {
      toast.error('Could not generate spec sheet');
    } finally {
      setSpecBusy(false);
    }
  };

  const additionalRecon = b ? b.recon - reconLedgerTotal : 0;

  return (
    <div className="space-y-6">
      {/* === HEADER STATS === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Total Gross Revenue" value={fmtR(headerMetrics.grossRevenue)} valueClass="text-emerald-400" sub="Sum of all finalized selling prices" />
        <StatCard icon={<Receipt className="w-4 h-4 text-cyan-400" />} label="Total Net Profit" value={fmtR(headerMetrics.netProfit)} valueClass={headerMetrics.netProfit >= 0 ? 'text-cyan-400' : 'text-red-400'} sub="After cost, recon, payouts & reg" />
        <StatCard icon={<Percent className="w-4 h-4 text-amber-400" />} label={`Output VAT (${vatRate}%)`} value={fmtR(headerMetrics.outputVat)} valueClass="text-amber-400" sub={vatRegistered ? 'Embedded VAT on sales' : 'Not VAT registered yet'} />
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-purple-400" />} label="Total Finalized Deals" value={String(headerMetrics.dealCount)} valueClass="text-purple-400" sub="Delivered / finalized count" />
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
              const count = vw === 'pending' ? finalizedDeals.filter((d) => !d.application?.is_invoiced).length : finalizedDeals.length;
              return (
                <button key={vw} onClick={() => setView(vw)} className={cn('px-3 py-1.5 text-xs font-medium rounded-sm transition-colors', active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {vw === 'pending' ? 'Pending Invoices' : 'All Deals'} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const visibleDeals = view === 'pending' ? finalizedDeals.filter((d) => !d.application?.is_invoiced) : finalizedDeals;
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
                    {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading deals…</TableCell></TableRow>}
                    {!isLoading && visibleDeals.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{view === 'pending' ? 'No pending invoices — all clear.' : 'No finalized deals yet.'}</TableCell></TableRow>
                    )}
                    {visibleDeals.map((d) => {
                      const app = d.application; const v = d.vehicle;
                      const firstName = app?.first_name || (app?.full_name || '').split(' ')[0] || '';
                      const lastName = app?.last_name || (app?.full_name || '').split(' ').slice(1).join(' ') || '';
                      const clientName = `${firstName} ${lastName}`.trim() || app?.full_name || '—';
                      const dateStr = d.sale_date ? format(new Date(d.sale_date), 'dd MMM yyyy') : format(new Date(d.created_at), 'dd MMM yyyy');
                      const vehicleLabel = v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—' : '—';
                      const isFinance = d.deal_type === 'finance';
                      const financeVendor = d.finance_house_vendor_id ? vendorMap.get(d.finance_house_vendor_id) : undefined;
                      const netProfit = dealNetProfit(d);
                      return (
                        <TableRow key={d.id} onClick={() => setActiveDeal(d)} className={cn('cursor-pointer transition-colors hover:bg-muted', d.application?.is_invoiced && 'opacity-50 text-muted-foreground')}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={!!d.application?.is_invoiced} disabled={!d.application?.id || toggleInvoiced.isPending}
                              onCheckedChange={(checked) => { if (d.application?.id) toggleInvoiced.mutate({ appId: d.application.id, value: checked === true }); }} aria-label="Mark as invoiced" />
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dateStr}</TableCell>
                          <TableCell><div className="font-medium text-sm">{clientName}</div><div className="text-xs text-muted-foreground">ID: {app?.id_number || '—'}</div></TableCell>
                          <TableCell><div className="font-medium text-sm">{vehicleLabel}</div><div className="text-xs text-muted-foreground">{v?.registration_number || 'No reg'}</div></TableCell>
                          <TableCell className="text-sm">
                            {isFinance ? <span className="inline-flex items-center gap-1 text-purple-400"><Banknote className="w-3 h-3" />{financeVendor?.name || 'Finance (not set)'}</span> : <span className="text-muted-foreground">Customer (direct)</span>}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-400">{fmtR(num(d.sold_price))}</TableCell>
                          <TableCell className={cn('text-right font-semibold tabular-nums', netProfit >= 0 ? 'text-cyan-400' : 'text-red-400')}>{fmtR(netProfit)}</TableCell>
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
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-background border-border text-foreground overflow-y-auto p-5 sm:p-6">
          {b && activeDeal && (
            <>
              <SheetHeader className="space-y-1 pb-3 border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <SheetTitle className="text-foreground select-text text-lg">{b.clientName}</SheetTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => handleDownloadInvoice(activeDeal)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> {isTaxInvoiceForDeal(activeDeal) ? 'Tax Invoice' : 'Invoice'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={specBusy} onClick={() => downloadSpec(activeDeal)}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> {specBusy ? '…' : 'Spec Sheet'}
                    </Button>
                  </div>
                </div>
                <SheetDescription className="select-text text-muted-foreground text-xs">
                  {b.vehicleLabel} · Finalized {b.dateStr}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Parties */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <div className="select-text min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Bought From</div>
                    <div className="text-sm font-medium text-foreground mt-0.5 truncate">{b.boughtFromVendor?.name || '— not set —'}</div>
                    <div className="text-xs text-muted-foreground">{fmtR(b.vehicleCost)}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-right select-text min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-end gap-1">{b.isFinance ? <Banknote className="w-3 h-3" /> : null} Sold To</div>
                    <div className="text-sm font-medium text-foreground mt-0.5 truncate">{b.soldToName}</div>
                    <div className="text-xs text-muted-foreground">{b.isFinance ? `for ${b.clientName}` : 'Direct to customer'}</div>
                  </div>
                </div>

                {/* Client + Vehicle — compact two-column */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  <InfoList title="Client" rows={[
                    ['ID Number', b.app?.id_number || '—'],
                    ['Phone', b.app?.phone || '—'],
                    ['Email', b.app?.email || '—'],
                    ['Bank / Finance', b.app?.contract_bank_name || '—'],
                    ['Bank Reference', b.app?.bank_reference || '—'],
                  ]} />
                  <InfoList title="Vehicle" rows={[
                    ['Make / Model', `${b.v?.make || ''} ${b.v?.model || ''}`.trim() || '—'],
                    ['Year', b.v?.year ? String(b.v.year) : '—'],
                    ['VIN', b.v?.vin || '—'],
                    ['Registration', b.v?.registration_number || '—'],
                    ['Deal Type', b.isFinance ? 'Through finance house' : 'Direct to customer'],
                  ]} />
                </div>

                {/* Financial statement */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <GroupHeader>Income</GroupHeader>
                  <div className="px-4 py-2">
                    <Line label="Gross selling price" value={fmtR(b.grossSelling)} tone="emerald" />
                    {b.discount > 0 && <Line label="Discount given" value={`- ${fmtR(b.discount)}`} tone="red" />}
                    <Line label="DIC (dealer incentive)" value={fmtR(b.dic)} />
                    <Line label="VAP revenue" value={fmtR(b.vapRevenue)} />
                    <Line label="Referral income" value={fmtR(b.referralIncome)} />
                  </div>
                  <GroupHeader>Costs &amp; Deductions</GroupHeader>
                  <div className="px-4 py-2">
                    <Line label="Vehicle purchase cost" value={fmtR(b.vehicleCost)} />
                    <Line label="Recon total" value={fmtR(b.recon)} />
                    <Line label="VAP cost" value={fmtR(b.vapCost)} />
                    <Line label="Aftersales expenses" value={fmtR(b.expensesTotal)} />
                    <Line label="Sales-rep commission" value={fmtR(b.commission)} tone="red" />
                    <Line label="Referral payout" value={fmtR(b.referralPayout)} tone="red" />
                    <Line label="Partner profit share" value={fmtR(b.partnerProfitShare)} tone="red" />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-emerald-500/5">
                    <span className="text-sm font-semibold text-foreground">Net Profit (Lumina)</span>
                    <span className={cn('text-lg font-bold tabular-nums', b.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmtR(b.netProfit)}</span>
                  </div>
                  {b.partnerCapital > 0 && (
                    <div className="px-4 pb-2.5 -mt-1 text-[11px] text-muted-foreground">
                      Partner capital returned (not a cost): {fmtR(b.partnerCapital)}
                    </div>
                  )}
                </div>

                {/* Recon / vehicle expense LINE ITEMS */}
                <section>
                  <GroupTitle>Recon &amp; Vehicle Expenses ({vehicleExpenses.length})</GroupTitle>
                  {vehicleExpenses.length === 0 && additionalRecon <= 0.005 ? (
                    <p className="text-xs text-muted-foreground">No itemised recon costs logged for this vehicle.</p>
                  ) : (
                    <ul className="space-y-1">
                      {vehicleExpenses.map((e) => (
                        <li key={e.id} className="flex justify-between gap-3 text-sm select-text">
                          <span className="text-foreground/80 min-w-0 truncate">
                            {e.description || catLabel(e.category)}
                            <span className="text-muted-foreground text-xs"> · {catLabel(e.category)}{e.date_incurred ? ` · ${format(new Date(e.date_incurred), 'dd MMM')}` : ''}</span>
                          </span>
                          <span className="tabular-nums text-foreground">{fmtR(num(e.amount))}</span>
                        </li>
                      ))}
                      {additionalRecon > 0.005 && (
                        <li className="flex justify-between gap-3 text-sm select-text">
                          <span className="text-foreground/80">Additional deal recon (not on ledger)</span>
                          <span className="tabular-nums text-foreground">{fmtR(additionalRecon)}</span>
                        </li>
                      )}
                      <li className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1.5">
                        <span>Recon total</span><span className="tabular-nums">{fmtR(b.recon)}</span>
                      </li>
                    </ul>
                  )}
                </section>

                {/* Aftersales / deal expense LINE ITEMS */}
                {b.expenseItems.length > 0 && (
                  <section>
                    <GroupTitle>Aftersales / Deal Expenses ({b.expenseItems.length})</GroupTitle>
                    <ul className="space-y-1">
                      {b.expenseItems.map((e, i) => (
                        <li key={i} className="flex justify-between gap-3 text-sm select-text">
                          <span className="text-foreground/80 min-w-0 truncate">{expenseLabel(e)}</span>
                          <span className="tabular-nums text-foreground">{fmtR(expenseAmount(e))}</span>
                        </li>
                      ))}
                      <li className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1.5">
                        <span>Total</span><span className="tabular-nums">{fmtR(b.expensesTotal)}</span>
                      </li>
                    </ul>
                  </section>
                )}

                {/* VAPs LINE ITEMS */}
                {b.addonItems.length > 0 && (
                  <section>
                    <GroupTitle>Value-Added Products ({b.addonItems.length})</GroupTitle>
                    <ul className="space-y-1">
                      {b.addonItems.map((a, i) => (
                        <li key={i} className="flex justify-between gap-3 text-sm select-text">
                          <span className="text-foreground/80 min-w-0 truncate">{a.name || 'VAP'}</span>
                          <span className="tabular-nums text-muted-foreground text-xs">cost {fmtR(num(a.cost))} → sell <span className="text-foreground text-sm">{fmtR(num(a.price))}</span></span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* VAT */}
                <section className="rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <GroupTitle className="mb-0">VAT</GroupTitle>
                    <span className="text-xs text-muted-foreground">{vatRegistered ? `Registered · ${vatRate}%` : 'Not registered'}</span>
                  </div>
                  <Line label={`Output VAT (${vatRate}%) on selling price`} value={fmtR(vatRate > 0 ? b.grossSelling * (vatRate / (100 + vatRate)) : 0)} tone="amber" />
                  {!vatRegistered && <p className="text-[11px] text-muted-foreground mt-1">No VAT charged. Turn on “We are VAT registered” in Document Settings to issue Tax Invoices (VAT shown, even at 0%).</p>}
                </section>

                {/* Invoice lines */}
                <section className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <GroupTitle className="mb-0">Invoice — bill to {b.soldToName}</GroupTitle>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => handleDownloadInvoice(activeDeal)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                  </div>
                  {b.isFinance && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/60 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Finance house pays</span>
                      <span className="text-xs text-foreground/80">
                        {b.financeBasis === 'margin' ? 'Margin (selling − cost)' : 'Full selling price'}
                        <span className="text-muted-foreground"> · set in Finalize Deal</span>
                      </span>
                    </div>
                  )}
                  <ul className="mt-2 space-y-1 border-t border-border pt-2">
                    {b.invoiceLines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-3 text-sm select-text">
                        <span className="text-foreground/80 min-w-0 truncate">{l.description}</span>
                        <span className="tabular-nums text-foreground">{fmtR(l.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1.5">
                      <span>Invoice total</span><span className="tabular-nums">{fmtR(b.invoiceTotal)}</span>
                    </li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Lines come from the "include on invoice" tickboxes set when finalizing.</p>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {invoicePreview && docSettings && (
        <InvoicePrintPreview payload={invoicePreview} settings={docSettings} onClose={() => setInvoicePreview(null)} />
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, valueClass, sub }: { icon: React.ReactNode; label: string; value: string; valueClass: string; sub: string }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">{icon}{label}</CardTitle></CardHeader>
    <CardContent>
      <p className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </CardContent>
  </Card>
);

const GroupHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-muted/60 px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-bold border-t border-border first:border-t-0">{children}</div>
);
const GroupTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h4 className={cn('text-[11px] uppercase font-bold tracking-wider text-muted-foreground mb-2', className)}>{children}</h4>
);
const Line = ({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'red' | 'amber' }) => (
  <div className="flex justify-between gap-4 py-0.5 text-sm select-text">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn('tabular-nums', tone === 'emerald' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : 'text-foreground')}>{value}</span>
  </div>
);
const InfoList = ({ title, rows }: { title: string; rows: [string, string][] }) => (
  <div>
    <GroupTitle>{title}</GroupTitle>
    <dl className="divide-y divide-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-foreground text-right select-text break-all">{v}</dd>
        </div>
      ))}
    </dl>
  </div>
);

export default AccountingVATTab;
