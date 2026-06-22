import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Deal } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatRand, formatRandCompact, formatDate, monthKey, formatMonth } from '@/lib/dealdesk/format';
import { StatusBadge, NatisChip } from './badges';
import { useDeskSettings } from '@/hooks/dealdesk/useDealDesk';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </CardContent></Card>
  );
}

export function DealsTable({ deals, onOpen }: { deals: Deal[]; onOpen: (d: Deal) => void }) {
  const { data: settings } = useDeskSettings();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState<string>('all');

  const months = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => { const k = monthKey(d.sale_date || d.created_at); if (k) set.add(k); });
    return Array.from(set).sort().reverse();
  }, [deals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (month !== 'all' && monthKey(d.sale_date || d.created_at) !== month) return false;
      if (!q) return true;
      return [d.client_name, d.vehicle_make_model, d.vehicle_vin, d.vehicle_stock_no, d.client_phone]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [deals, search, month]);

  const totalGP = filtered.reduce((s, d) => s + (Number(d.gross_profit) || 0), 0);
  const units = filtered.length;
  const avgGP = units ? totalGP / units : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total GP (ledger)" value={formatRandCompact(totalGP)} />
        <Stat label="Avg GP" value={formatRandCompact(avgGP)} />
        <Stat label="Units" value={String(units)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, VIN, stock #…" className="pl-8 h-9" />
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{formatMonth(m + '-01')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Client</th>
              <th className="px-3 py-2 text-left font-medium">Vehicle</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Natis</th>
              <th className="px-3 py-2 text-left font-medium">Sale date</th>
              <th className="px-3 py-2 text-right font-medium">GP (ledger)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((d) => (
              <tr key={d.id} onClick={() => onOpen(d)} className="cursor-pointer transition hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{d.client_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{d.client_phone || ''}</div>
                </td>
                <td className="px-3 py-2 text-xs">{d.vehicle_make_model || '—'}{d.vehicle_year ? ` · ${d.vehicle_year}` : ''}</td>
                <td className="px-3 py-2"><StatusBadge status={d.deal_status} /></td>
                <td className="px-3 py-2"><NatisChip status={natisStatus(d, settings)} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.sale_date) || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-400">{formatRand(d.gross_profit)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No deals match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        GP shown is the deal's recorded <strong>ledger</strong> gross profit (from Finalize Deal). The Cost Sheet tab's
        "Correct Total" is analytical and may differ — it never overrides this value.
      </p>
    </div>
  );
}
