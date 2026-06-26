// Finance House Performance — per-company stats over finance applications, shown on
// the Vendors page. Reads the read-only aggregate RPC (lum_vendor_finance_stats) via
// useVendorFinanceStats; never touches the deal ledger. Each application is attributed
// to the Finance House of its handling F&I user (set in Team Management).
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, TrendingUp, Loader2 } from 'lucide-react';
import { useVendorFinanceStats } from '@/hooks/useVendors';

type RangeKey = 'month' | 'year' | 'all';

const RANGE_LABEL: Record<RangeKey, string> = {
  month: 'This month',
  year: 'This year',
  all: 'All time',
};

function rangeBounds(key: RangeKey): { since: string; until: string } {
  const now = new Date();
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // include today
  if (key === 'month') {
    return { since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), until };
  }
  if (key === 'year') {
    return { since: new Date(now.getFullYear(), 0, 1).toISOString(), until };
  }
  return { since: '2000-01-01T00:00:00.000Z', until: '2100-01-01T00:00:00.000Z' };
}

const zar = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n || 0);

export function FinanceHousePerformance() {
  const [range, setRange] = useState<RangeKey>('month');
  const { since, until } = useMemo(() => rangeBounds(range), [range]);
  const { data: stats = [], isLoading } = useVendorFinanceStats(since, until);

  // Only show the panel if there's at least one Finance House configured.
  if (!isLoading && stats.length === 0) return null;

  const totals = stats.reduce(
    (acc, s) => ({
      apps: acc.apps + s.app_count,
      approved: acc.approved + s.approved_count,
      finalized: acc.finalized + s.finalized_count,
      value: acc.value + s.total_sold_value,
    }),
    { apps: 0, approved: 0, finalized: 0, value: 0 },
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Finance House performance</h2>
            <span className="text-xs text-muted-foreground">applications by the F&amp;I's company</span>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{RANGE_LABEL.month}</SelectItem>
              <SelectItem value="year">{RANGE_LABEL.year}</SelectItem>
              <SelectItem value="all">{RANGE_LABEL.all}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Finance House</TableHead>
                <TableHead className="font-semibold text-center">F&amp;I</TableHead>
                <TableHead className="font-semibold text-center">Apps</TableHead>
                <TableHead className="font-semibold text-center">Approved</TableHead>
                <TableHead className="font-semibold text-center">Approval&nbsp;%</TableHead>
                <TableHead className="font-semibold text-center">Deals</TableHead>
                <TableHead className="font-semibold text-right">Sold value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                </TableCell></TableRow>
              )}
              {!isLoading && stats.map((s) => (
                <TableRow key={s.vendor_id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      <Banknote className="w-3.5 h-3.5 text-purple-400" /> {s.vendor_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">{s.fni_count}</TableCell>
                  <TableCell className="text-center text-sm">{s.app_count}</TableCell>
                  <TableCell className="text-center text-sm">{s.approved_count}</TableCell>
                  <TableCell className="text-center">
                    {s.app_count > 0 ? (
                      <Badge variant="outline" className={
                        s.approval_rate >= 60 ? 'border-emerald-500/30 text-emerald-400'
                        : s.approval_rate >= 30 ? 'border-amber-500/30 text-amber-400'
                        : 'border-red-500/30 text-red-400'
                      }>{s.approval_rate}%</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm">{s.finalized_count}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{zar(s.total_sold_value)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && stats.length > 1 && (
                <TableRow className="border-t-2 border-border font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-center text-sm">{totals.apps}</TableCell>
                  <TableCell className="text-center text-sm">{totals.approved}</TableCell>
                  <TableCell className="text-center text-sm">
                    {totals.apps > 0 ? `${Math.round((totals.approved / totals.apps) * 100)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">{totals.finalized}</TableCell>
                  <TableCell className="text-right text-sm">{zar(totals.value)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Each application counts toward the Finance House of the F&amp;I who handled it (set in Team Management).
          "Sold value" sums finalized deal sale prices.
        </p>
      </CardContent>
    </Card>
  );
}
