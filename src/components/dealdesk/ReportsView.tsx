import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Deal } from '@/lib/dealdesk/types';
import { formatRand, formatMonth, monthKey } from '@/lib/dealdesk/format';
import { isAwaitingFinalize } from './isAwaitingFinalize';
import {
  addMonths, aggregateByCondition, aggregateByMonth, dealMonthKey, formatMonthShort, monthSeq,
} from './reports/reportData';

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={'mt-1 text-2xl font-bold tabular-nums ' + (accent ? 'text-emerald-400' : '')}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function ReportsView({ deals }: { deals: Deal[] }) {
  // Reports only count finalized deals — auto-created drafts (contract signed,
  // no sale date, zero recorded profit) are excluded so totals tie out to the
  // ledger even for admins, who do receive drafts in the `deals` prop.
  const finalized = useMemo(() => deals.filter((d) => !isAwaitingFinalize(d)), [deals]);

  const nowKey = monthKey(new Date().toISOString());

  // Continuous month options spanning earliest data month → current month (or
  // latest data month if it's somehow later), so range selects have no gaps.
  const monthOptions = useMemo(() => {
    const keys = finalized.map(dealMonthKey).filter(Boolean).sort();
    if (keys.length === 0) return [nowKey];
    const first = keys[0];
    const last = keys[keys.length - 1] > nowKey ? keys[keys.length - 1] : nowKey;
    return monthSeq(first, last);
  }, [finalized, nowKey]);

  const first = monthOptions[0];
  const last = monthOptions[monthOptions.length - 1];
  const clampKey = (k: string) => (k < first ? first : k > last ? last : k);

  // null = "not touched yet" → defaults to This year.
  const [fromSel, setFromSel] = useState<string | null>(null);
  const [toSel, setToSel] = useState<string | null>(null);
  const effFrom = clampKey(fromSel ?? `${nowKey.slice(0, 4)}-01`);
  const effTo = clampKey(toSel ?? nowKey);
  const [lo, hi] = effFrom <= effTo ? [effFrom, effTo] : [effTo, effFrom];

  const chips = [
    { label: 'This year', from: clampKey(`${nowKey.slice(0, 4)}-01`), to: clampKey(nowKey) },
    { label: 'Last 3 months', from: clampKey(addMonths(nowKey, -2)), to: clampKey(nowKey) },
    { label: 'All time', from: first, to: last },
  ];

  const inRange = useMemo(
    () => finalized.filter((d) => { const k = dealMonthKey(d); return k >= lo && k <= hi; }),
    [finalized, lo, hi],
  );

  const monthRows = useMemo(() => aggregateByMonth(inRange, monthSeq(lo, hi)), [inRange, lo, hi]);
  const conditionRows = useMemo(() => aggregateByCondition(inRange), [inRange]);

  const totalGP = monthRows.reduce((s, r) => s + r.gp, 0);
  const totalUnits = inRange.length;
  const avgGP = totalUnits ? totalGP / totalUnits : 0;

  const chartData = monthRows.map((r) => ({ ...r, label: formatMonthShort(r.key), full: formatMonth(r.key + '-01') }));
  const tableRows = monthRows.filter((r) => r.units > 0);

  const exportCsv = () => {
    const lines = [
      ['Month', 'Units', 'GP', 'Avg'],
      ...tableRows.map((r) => [formatMonth(r.key + '-01'), String(r.units), String(r.gp), String(r.avg)]),
      ['Total', String(totalUnits), String(Math.round(totalGP)), String(Math.round(avgGP))],
    ];
    const csv = '﻿' + lines.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'deal-desk-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--foreground))',
  } as const;

  return (
    <div className="space-y-4">
      {/* Date-range filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">From</span>
        <Select value={effFrom} onValueChange={setFromSel}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => <SelectItem key={m} value={m}>{formatMonth(m + '-01')}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">To</span>
        <Select value={effTo} onValueChange={setToSel}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => <SelectItem key={m} value={m}>{formatMonth(m + '-01')}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          {chips.map((c) => {
            const active = c.from === lo && c.to === hi;
            return (
              <Button
                key={c.label}
                size="sm"
                variant={active ? 'secondary' : 'outline'}
                className="h-8 text-xs"
                onClick={() => { setFromSel(c.from); setToSel(c.to); }}
              >
                {c.label}
              </Button>
            );
          })}
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Total profit (ledger)" value={formatRand(totalGP)} accent />
        <StatTile label="Total units" value={String(totalUnits)} />
        <StatTile label="Avg GP / unit" value={formatRand(avgGP)} />
      </div>

      {/* Profit by month: chart + compact table */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">Profit by month (ledger GP)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {totalUnits === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No finalized deals in this range.</p>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      interval={chartData.length > 12 ? 'preserveStartEnd' : 0}
                    />
                    <YAxis
                      tickFormatter={(v) => `R${Math.round(Number(v) / 1000)}k`}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [formatRand(Number(v)), 'Gross profit']}
                      labelFormatter={(_l: any, payload: any) => payload?.[0]?.payload?.full ?? ''}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                    />
                    <Bar dataKey="gp" fill="hsl(var(--desk-accent))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3 text-left font-medium">Month</th>
                      <th className="py-1.5 px-3 text-right font-medium">Units</th>
                      <th className="py-1.5 px-3 text-right font-medium">GP</th>
                      <th className="py-1.5 pl-3 text-right font-medium">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.key} className="border-b border-border/50">
                        <td className="py-1.5 pr-3">{formatMonth(r.key + '-01')}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{r.units}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{formatRand(r.gp)}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{formatRand(r.avg)}</td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-1.5 pr-3">Total</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{totalUnits}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-emerald-400">{formatRand(totalGP)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{formatRand(avgGP)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Units & GP by condition */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">Units &amp; GP by condition</CardTitle></CardHeader>
        <CardContent>
          {conditionRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No finalized deals in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-3 text-left font-medium">Condition</th>
                    <th className="py-1.5 px-3 text-right font-medium">Units</th>
                    <th className="py-1.5 px-3 text-right font-medium">GP</th>
                    <th className="py-1.5 pl-3 text-right font-medium">Avg GP</th>
                  </tr>
                </thead>
                <tbody>
                  {conditionRows.map((r) => (
                    <tr key={r.key} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-3">{r.label}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{r.units}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{formatRand(r.gp)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{formatRand(r.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Profit reflects the deal's recorded <strong>ledger</strong> gross profit so totals tie out to Accounting &amp; VAT.
        Un-finalized drafts are excluded.
      </p>
    </div>
  );
}
