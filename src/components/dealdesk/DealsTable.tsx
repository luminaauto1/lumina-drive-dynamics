import { useMemo, useRef, useState } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Deal } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatRand, formatRandCompact, formatDate, monthKey, formatMonth } from '@/lib/dealdesk/format';
import { StatusBadge, NatisChip } from './badges';
import { StatusBadge as FinanceStatusBadge } from '@/components/admin/StatusBadge';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useDeskSettings } from '@/hooks/dealdesk/useDealDesk';
import { useAuth } from '@/contexts/AuthContext';
import { SavedViewsBar } from '@/components/admin/SavedViewsBar';
import { useSavedViews } from '@/hooks/useSavedViews';

import { isAwaitingFinalize } from './isAwaitingFinalize';
export { isAwaitingFinalize };

/** Persisted Deal Desk filter preset (saved views). Search text excluded. */
interface DealDeskPreset { month: string; view: 'all' | 'awaiting' }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </CardContent></Card>
  );
}

export function DealsTable(
  { deals, onOpen, canSeeDrafts = false }:
  { deals: Deal[]; onOpen: (d: Deal) => void; canSeeDrafts?: boolean },
) {
  const { data: settings } = useDeskSettings();
  const { labels: financeLabels, styles: financeStyles } = useStatusConfig();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState<string>('all');
  const [view, setView] = useState<'all' | 'awaiting'>('all');

  // Saved views (per-user filter presets) — month + awaiting toggle.
  const { views, saveView, deleteView } = useSavedViews<DealDeskPreset>('dealdesk', user?.id);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Non-admins never see un-finalized drafts at all.
  const visibleDeals = useMemo(
    () => (canSeeDrafts ? deals : deals.filter((d) => !isAwaitingFinalize(d))),
    [deals, canSeeDrafts],
  );

  const awaitingCount = useMemo(
    () => (canSeeDrafts ? visibleDeals.filter(isAwaitingFinalize).length : 0),
    [visibleDeals, canSeeDrafts],
  );

  const months = useMemo(() => {
    const set = new Set<string>();
    visibleDeals.forEach((d) => { const k = monthKey(d.sale_date || d.created_at); if (k) set.add(k); });
    return Array.from(set).sort().reverse();
  }, [visibleDeals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleDeals.filter((d) => {
      if (view === 'awaiting' && !isAwaitingFinalize(d)) return false;
      if (month !== 'all' && monthKey(d.sale_date || d.created_at) !== month) return false;
      if (!q) return true;
      return [d.client_name, d.vehicle_make_model, d.vehicle_vin, d.vehicle_stock_no, d.client_phone]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [visibleDeals, search, month, view]);

  const totalGP = filtered.reduce((s, d) => s + (Number(d.gross_profit) || 0), 0);
  const units = filtered.length;
  const avgGP = units ? totalGP / units : 0;

  // Keyboard navigation: ↑/↓ move row focus, Enter opens (rows carry data-row-index).
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const focusRow = (idx: number) => {
    const rows = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row-index]');
    if (!rows || rows.length === 0) return;
    rows[Math.max(0, Math.min(idx, rows.length - 1))]?.focus();
  };
  const onRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, idx: number, deal: Deal) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(idx - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); onOpen(deal); }
  };

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
        {canSeeDrafts && (
          <Select value={view} onValueChange={(v) => { setView(v as 'all' | 'awaiting'); setActiveViewId(null); }}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All deals</SelectItem>
              <SelectItem value="awaiting">Awaiting finalize{awaitingCount ? ` (${awaitingCount})` : ''}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={month} onValueChange={(v) => { setMonth(v); setActiveViewId(null); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{formatMonth(m + '-01')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <SavedViewsBar
        views={views}
        activeId={activeViewId}
        onApply={(v) => { setMonth(v.preset.month); if (canSeeDrafts) setView(v.preset.view); setActiveViewId(v.id); }}
        onSave={(name) => saveView(name, { month, view })}
        onDelete={(id) => { deleteView(id); if (id === activeViewId) setActiveViewId(null); }}
      />

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
          <tbody ref={tbodyRef} className="divide-y divide-border">
            {filtered.map((d, idx) => (
              <tr key={d.id} data-row-index={idx} tabIndex={0} onClick={() => onOpen(d)}
                onKeyDown={(e) => onRowKeyDown(e, idx, d)}
                className="cursor-pointer transition hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60">
                <td className="px-3 py-2">
                  <div className="font-medium">{d.client_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{d.client_phone || ''}</div>
                </td>
                <td className="px-3 py-2 text-xs">{d.vehicle_make_model || '—'}{d.vehicle_year ? ` · ${d.vehicle_year}` : ''}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge stage={d.deal_stage} />
                    {d.finance_status && (
                      <FinanceStatusBadge track="finance" value={d.finance_status}
                        labelOverrides={financeLabels} styleOverrides={financeStyles} />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2"><NatisChip status={natisStatus(d, settings)} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.sale_date) || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-400">{formatRand(d.gross_profit)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12">
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                  <ClipboardList className="h-8 w-8 opacity-40" />
                  {visibleDeals.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-foreground">No deals yet</p>
                      <p className="text-xs">Finalized deals appear here. Finalize a deal from the Finance page to get started.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">No deals match these filters</p>
                      <p className="text-xs">Try clearing the search or selecting a different month.</p>
                    </>
                  )}
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        GP shown here is the deal's official recorded profit (set in <strong>Finalize Deal</strong>). The Cost Sheet tab is
        for internal/operational tracking only and never changes this value, so its "Correct Total" may differ.
      </p>
    </div>
  );
}
