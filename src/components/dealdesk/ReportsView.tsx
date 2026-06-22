import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Deal } from '@/lib/dealdesk/types';
import { DEAL_STATUS_LABEL } from '@/lib/dealdesk/types';
import { formatRand, formatMonth, monthKey } from '@/lib/dealdesk/format';

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ReportsView({ deals }: { deals: Deal[] }) {
  const byMonth = useMemo(() => {
    const m = new Map<string, { gp: number; units: number }>();
    for (const d of deals) {
      const k = monthKey(d.sale_date || d.created_at);
      if (!k) continue;
      const cur = m.get(k) || { gp: 0, units: 0 };
      cur.gp += Number(d.gross_profit) || 0; cur.units += 1;
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort().map(([k, v]) => ({ month: formatMonth(k + '-01').replace(' ', '\n'), key: k, gp: Math.round(v.gp), units: v.units }));
  }, [deals]);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of deals) m.set(d.deal_status, (m.get(d.deal_status) || 0) + 1);
    return Array.from(m.entries()).map(([s, n]) => ({ status: DEAL_STATUS_LABEL[s as keyof typeof DEAL_STATUS_LABEL] || s, units: n }));
  }, [deals]);

  const exportCsv = () => {
    const header = ['Month', 'Units', 'Gross profit (ledger)'];
    const lines = [header, ...byMonth.map((r) => [formatMonth(r.key + '-01'), String(r.units), String(r.gp)])];
    const csv = '﻿' + lines.map((row) => row.map((c) => csvCell(c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'deal-desk-profit-by-month.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</Button>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">Profit by month (ledger GP)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMonth} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval={0} />
                <YAxis tickFormatter={(v) => `R${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(v: any) => formatRand(Number(v))} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="gp" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">Units by stage</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="units" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">Profit reflects the deal's recorded <strong>ledger</strong> gross profit so totals tie out to Accounting &amp; VAT.</p>
    </div>
  );
}
