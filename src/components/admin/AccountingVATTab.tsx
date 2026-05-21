import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Receipt, TrendingUp, Gift, Copy, User, Car, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error('Failed to copy');
  }
};

const AccountingVATTab = () => {
  const { data: deals = [], isLoading } = useAccountingDeals();

  // Finalized/Delivered filter: deal_records inherently represent finalized deals.
  // Strengthen by checking is_closed OR application status.
  const finalizedDeals = useMemo(() => {
    return deals.filter((d) => {
      const status = (d.application?.internal_status || d.application?.status || '').toLowerCase();
      return (
        d.is_closed ||
        status.includes('delivered') ||
        status.includes('finalized') ||
        status.includes('paid_out') ||
        status.includes('handover') ||
        // Fallback: a deal_record with a sale_date is treated as finalized
        !!d.sale_date
      );
    });
  }, [deals]);

  // === Header metrics ===
  const headerMetrics = useMemo(() => {
    const oneYearAgo = subDays(new Date(), 365);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    let rolling12 = 0;
    let ytdVAP = 0;
    let ytdDIC = 0;

    finalizedDeals.forEach((d) => {
      const saleDate = d.sale_date ? new Date(d.sale_date) : new Date(d.created_at);
      const vatableSubtotal = Number(d.sold_price || 0); // gross selling price

      if (saleDate >= oneYearAgo) {
        rolling12 += vatableSubtotal;
      }
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
        <CardHeader>
          <CardTitle>Accounting Ledger</CardTitle>
          <CardDescription>
            Finalized / Delivered deals · One-click copy for external invoicing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Client</TableHead>
                  <TableHead className="font-semibold">Vehicle</TableHead>
                  <TableHead className="font-semibold text-right">Gross Revenue</TableHead>
                  <TableHead className="font-semibold text-right">VAP / Extras</TableHead>
                  <TableHead className="font-semibold text-right">Partner Payout</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
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
                {!isLoading && finalizedDeals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No finalized deals yet.
                    </TableCell>
                  </TableRow>
                )}
                {finalizedDeals.map((d) => {
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
                  const phone = app?.phone || '—';
                  const vapTotal = sumAddons(d.addons_data);
                  const extras = addonsList(d.addons_data);
                  const partnerPayout =
                    Number(d.partner_profit_amount || 0) +
                    Number(d.partner_capital_contribution || 0);

                  const dateStr = d.sale_date
                    ? format(new Date(d.sale_date), 'dd MMM yyyy')
                    : format(new Date(d.created_at), 'dd MMM yyyy');

                  const vehicleLabel = v
                    ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—'
                    : '—';

                  const clientCopy = `${firstName} ${lastName}\nID: ${idNumber}\nPhone: ${phone}`;
                  const vehicleCopy = `${v?.year || ''} ${v?.make || ''} ${v?.model || ''} - VIN: ${v?.vin || 'N/A'} - Reg: ${v?.registration_number || 'N/A'}`;
                  const vapCopy =
                    extras.length > 0
                      ? `Value Added Products: ${extras.join(', ')} - Total: ${fmtR(vapTotal)}`
                      : 'Value Added Products: None';

                  return (
                    <TableRow key={d.id} className="hover:bg-muted/30">
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-2">
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Copy for Invoice</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(clientCopy, 'Client details')}
                              className="gap-2"
                            >
                              <User className="w-4 h-4" /> Client Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(vehicleCopy, 'Vehicle line item')}
                              className="gap-2"
                            >
                              <Car className="w-4 h-4" /> Vehicle Line Item
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(vapCopy, 'VAP line item')}
                              className="gap-2"
                            >
                              <Package className="w-4 h-4" /> VAP Line Item
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground italic mt-3">
            Partner Payout shown in red is a Cost of Sale — it is <strong>not</strong> deducted from Gross Revenue and must be paid out separately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountingVATTab;
