import { useMemo, useRef, useState } from 'react';
import { Search, ClipboardList, MessageCircle, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Deal } from '@/lib/dealdesk/types';
import { DEAL_STAGE_LABEL } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatRand, formatDate, monthKey, formatMonth, daysBetween, sastToday } from '@/lib/dealdesk/format';
import { StatusBadge, NatisChip } from './badges';
import { StatusBadge as FinanceStatusBadge } from '@/components/admin/StatusBadge';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useDeskSettings } from '@/hooks/dealdesk/useDealDesk';
import { useAuth } from '@/contexts/AuthContext';
import { SavedViewsBar } from '@/components/admin/SavedViewsBar';
import { useSavedViews } from '@/hooks/useSavedViews';
import {
  DEAL_COLUMNS, columnClass, loadConfig, type DealColumnDef, type DealTableConfig,
} from '@/lib/dealdesk/columns';
import { DealsColumnsPicker } from './DealsColumnsPicker';

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
  // Default to the current month (SAST), matching the dashboard's period default.
  // The "All months" option and other months remain selectable in the dropdown.
  const [month, setMonth] = useState<string>(() => monthKey(new Date().toISOString()));
  const [view, setView] = useState<'all' | 'awaiting'>('all');

  // Saved views (per-user filter presets) — month + awaiting toggle.
  const { views, saveView, deleteView } = useSavedViews<DealDeskPreset>('dealdesk', user?.id);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Customizable columns (show/hide, reorder, resize) — persisted per-browser in
  // localStorage under the Deal-Desk-namespaced key (distinct from the pipeline).
  const [colConfig, setColConfig] = useState<DealTableConfig>(() => loadConfig());
  const colByKey = useMemo(() => new Map(DEAL_COLUMNS.map((c) => [c.key, c])), []);
  const visibleCols = useMemo(
    () => colConfig.visible.map((k) => colByKey.get(k)).filter(Boolean) as DealColumnDef[],
    [colConfig.visible, colByKey],
  );
  const classFor = (key: string) => {
    const def = colByKey.get(key);
    return columnClass(def, colConfig.widths[key] ?? def?.defaultWidth ?? 'normal');
  };

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
        <Stat label="Total GP (ledger)" value={formatRand(totalGP)} />
        <Stat label="Avg GP" value={formatRand(avgGP)} />
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
        <DealsColumnsPicker config={colConfig} onChange={setColConfig} />
      </div>

      <SavedViewsBar
        views={views}
        activeId={activeViewId}
        onApply={(v) => { setMonth(v.preset.month); if (canSeeDrafts) setView(v.preset.view); setActiveViewId(v.id); }}
        onSave={(name) => saveView(name, { month, view })}
        onDelete={(id) => { deleteView(id); if (id === activeViewId) setActiveViewId(null); }}
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="pipeline-table w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {visibleCols.map((col) => (
                <th key={col.key}
                  className={'px-3 py-2 font-medium ' + classFor(col.key) + (col.align === 'right' ? ' text-right' : ' text-left')}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="divide-y divide-border">
            {filtered.map((d, idx) => (
              <tr key={d.id} data-row-index={idx} tabIndex={0} onClick={() => onOpen(d)}
                onKeyDown={(e) => onRowKeyDown(e, idx, d)}
                className="cursor-pointer transition hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60">
                {visibleCols.map((col) => (
                  <td key={col.key}
                    className={'px-3 py-2 align-top ' + classFor(col.key) + (col.align === 'right' ? ' text-right tabular-nums' : '')}>
                    {renderDealCell(col.key, d, { settings, financeLabels, financeStyles })}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={Math.max(1, visibleCols.length)} className="py-12">
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

/** Per-column cell renderer for the Deals table. Display-only; never mutates a deal.
 *  GP keeps the same emerald colour + formatRand it had before. */
function renderDealCell(
  key: string,
  d: Deal,
  ctx: {
    settings: Parameters<typeof natisStatus>[1];
    financeLabels: Record<string, string>;
    financeStyles: Record<string, string>;
  },
): React.ReactNode {
  switch (key) {
    case 'client':
      return (
        <>
          <div className="font-medium">{d.client_name || '—'}</div>
          <div className="text-xs text-muted-foreground">{d.client_phone || ''}</div>
          {d.client_id_number && <div className="text-[10px] text-muted-foreground/70 font-mono">{d.client_id_number}</div>}
        </>
      );
    case 'vehicle':
      return (
        <span className="text-xs">
          {d.vehicle_make_model || '—'}{d.vehicle_year ? ` · ${d.vehicle_year}` : ''}
        </span>
      );
    case 'vin':
      return <span className="font-mono text-xs">{d.vehicle_vin || '—'}</span>;
    case 'stock_no':
      return <span className="font-mono text-xs">{d.vehicle_stock_no || '—'}</span>;
    case 'status':
      return (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge stage={d.deal_stage} />
          {d.finance_status && (
            <FinanceStatusBadge track="finance" value={d.finance_status}
              labelOverrides={ctx.financeLabels} styleOverrides={ctx.financeStyles} />
          )}
        </div>
      );
    case 'deal_stage':
      return <span className="text-xs">{DEAL_STAGE_LABEL[d.deal_stage] ?? '—'}</span>;
    case 'natis':
      return <NatisChip status={natisStatus(d, ctx.settings)} />;
    case 'delivery': {
      if (!d.delivery_date) return <span className="text-xs text-muted-foreground/50">—</span>;
      const days = daysBetween(d.delivery_date, sastToday());
      return (
        <>
          <span className="text-xs whitespace-nowrap">{formatDate(d.delivery_date)}</span>
          <div className="text-[10px] text-muted-foreground">{days <= 0 ? 'today' : `${days}d ago`}</div>
        </>
      );
    }
    case 'next_action': {
      // The aftersales "what do I do with this deal next" cell — the reason to
      // open this page. Derived display-only from existing fields.
      if (d.is_closed) return <span className="text-xs text-muted-foreground">Done ✓</span>;
      if (isAwaitingFinalize(d)) return <span className="text-xs font-medium text-amber-400">Finalize deal</span>;
      const st = natisStatus(d, ctx.settings);
      if (st.expired) return <span className="text-xs font-semibold text-red-400">NATIS overdue — {Math.abs(st.daysLeft ?? 0)}d</span>;
      if (st.active) {
        const cls = st.tone === 'red' ? 'text-red-400 font-semibold' : st.tone === 'amber' ? 'text-amber-400 font-medium' : 'text-muted-foreground';
        return <span className={'text-xs ' + cls}>Send NATIS — {st.daysLeft}d left</span>;
      }
      if (st.tone === 'cleared') return <span className="text-xs text-emerald-400">Ready to close</span>;
      return <span className="text-xs text-muted-foreground/50">—</span>;
    }
    case 'sale_date':
      return <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.sale_date) || '—'}</span>;
    case 'sold_price':
      return <span className="font-medium">{d.sold_price != null ? formatRand(d.sold_price) : '—'}</span>;
    case 'gp':
      return <span className="font-medium text-emerald-400">{formatRand(d.gross_profit)}</span>;
    case 'actions': {
      // Quick contact actions — stopPropagation so the row's open-deal click
      // doesn't fire. Phone normalised to the wa.me digits form (0… → 27…).
      const waDigits = (d.client_phone || '').replace(/\D/g, '').replace(/^0/, '27');
      if (!d.client_phone) return null;
      return (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {waDigits.length >= 8 && (
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" title="WhatsApp client"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          <a href={`tel:${d.client_phone}`} title="Call client"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Phone className="h-4 w-4" />
          </a>
        </div>
      );
    }
    default:
      return null;
  }
}
