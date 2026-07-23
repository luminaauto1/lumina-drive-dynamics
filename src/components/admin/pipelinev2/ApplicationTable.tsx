import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateFinanceApplication, type FinanceApplication } from '@/hooks/useFinanceApplications';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isFilterable, type FacetOption } from '@/lib/pipelinev2/filters';
import { STATUS_STYLES, ADMIN_STATUS_LABELS, statusBadgeClass } from '@/lib/statusConfig';
import { useDeskTheme } from '@/hooks/useDeskTheme';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { INTERNAL_STATUSES, normalizeInternalStatus, type InternalStatus } from '@/lib/internalStatusConfig';
import { formatCurrencyR, formatDate, formatTime, formatPhone, relativeTime, formatDuration, timerBucket, TIMER_BUCKET_CLASS } from '@/lib/pipelinev2/format';
import { CreditScanButton } from '@/components/finance/CreditScanButton';
import { TABLE_COLUMNS, columnClass, type TableConfig } from '@/lib/pipelinev2/columns';
import { sourceLabel } from '@/lib/pipelinev2/source';
import { latestUserNote } from '@/lib/pipelinev2/notes';

interface Busy { userId: string; name: string; color: string }

const appName = (a: FinanceApplication) =>
  (a as any).full_name || [(a as any).first_name, (a as any).last_name].filter(Boolean).join(' ') || '—';

export function ApplicationTable({
  applications, config, onSelect, onChangeStatus,
  selectable, selectedIds, onToggleSelect, onToggleSelectAll, busyByApp,
  statusLabels, statusStyles, windowKey, showCreditScan, onCreditCheckOutcome,
  facets, columnFilters, onColumnFilterChange,
  renderExtraCell, statusSelect, rowClassName, ensureVisibleId, onEnsuredVisible,
}: {
  applications: FinanceApplication[];
  config: TableConfig;
  onSelect: (id: string) => void;
  /** Opens the Change-status modal. `track` selects which tab it opens on
   *  (Finance Status badge → 'finance' (default); Client Status badge → 'client'). */
  onChangeStatus?: (app: FinanceApplication, track?: 'finance' | 'client') => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[], select: boolean) => void;
  busyByApp?: Map<string, Busy>;
  /** Optional admin-configured overrides (from status_overrides); fall back to statusConfig. */
  statusLabels?: Record<string, string>;
  statusStyles?: Record<string, string>;
  /** Changes whenever the parent's tab / search / filters change — resets the render window. */
  windowKey?: string;
  /** Per-row credit check (dropdown + CarTrust scan button) — New Applications lane only. */
  showCreditScan?: boolean;
  /** Opens the Credit Check result modal (screenshot/doc + status pick) for Passed/Failed. */
  onCreditCheckOutcome?: (app: FinanceApplication, outcome: 'passed' | 'failed') => void;
  /** Faceted options per filterable column (derived by the parent from the rows in
   *  view, before per-column filters). A header filter renders only when a visible
   *  column is filterable AND has ≥1 option here. */
  facets?: Record<string, FacetOption[]>;
  /** Current selections per column key ([] / missing = no filter on that column). */
  columnFilters?: Record<string, string[]>;
  /** Replace the selection for one column (empty array clears it). */
  onColumnFilterChange?: (key: string, values: string[]) => void;
  /** Page-supplied cell renderers (Finance preset). Consulted FIRST for every
   *  visible column; return undefined to fall back to the built-in cell. */
  renderExtraCell?: (key: string, app: FinanceApplication) => React.ReactNode | undefined;
  /** Inline status dropdown (Finance style). When provided, the 'status' column
   *  renders a Select wired to the page's interceptor chain instead of the
   *  badge-button that opens the Change-status modal. */
  statusSelect?: {
    options: (app: FinanceApplication) => { value: string; label: string }[];
    onChange: (app: FinanceApplication, status: string) => void;
  };
  /** Extra classes per row (highlight ring, pre-approved tint, ...). */
  rowClassName?: (app: FinanceApplication) => string;
  /** Grow the render window to include this app id and scroll its row into view
   *  (Action-Feed jump). Cleared via onEnsuredVisible once the scroll fired. */
  ensureVisibleId?: string | null;
  onEnsuredVisible?: () => void;
}) {
  const { theme } = useDeskTheme();
  const updateApplication = useUpdateFinanceApplication();
  // Client-status track (DB-driven, customizable). Only the label/colour maps are
  // needed now: the cell renders a badge button and the actual write happens in the
  // Change-status modal (Client tab), so no mutation is wired here anymore.
  const { clientLabels, clientStyles, timerStatuses } = useStatusConfig();
  // Live clock for the time-in-status timer column. Ticks once a minute so the
  // elapsed label and its colour advance without a manual refresh; thresholds are
  // in hours, so minute granularity is ample and the re-render is cheap (only the
  // windowed rows). Only actually mounts an interval when some status has a timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (timerStatuses.size === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [timerStatuses.size]);
  const colByKey = new Map(TABLE_COLUMNS.map((c) => [c.key, c]));
  const visible = config.visible.map((k) => colByKey.get(k)).filter(Boolean) as TableColumnDef[];
  type TableColumnDef = (typeof TABLE_COLUMNS)[number];

  const classFor = (key: string) => {
    const def = colByKey.get(key);
    return columnClass(def, config.widths[key] ?? def?.defaultWidth ?? 'normal');
  };
  const allIds = applications.map((a) => a.id);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));

  // WINDOWED RENDERING — the "All applications" tab holds 750+ rows and rendering
  // them all at once froze the browser. Render the first chunk and grow as the
  // sentinel row scrolls into view; selection/keyboard behaviour is unchanged
  // (select-all still selects every FILTERED row via allIds, not just rendered ones).
  // The window resets whenever the parent's tab/search/filters change (windowKey);
  // row-count alone is a weak proxy (two lanes can share a count) and is kept only
  // as a fallback for callers that don't pass a key.
  const CHUNK = 50;
  const [renderCount, setRenderCount] = useState(CHUNK);
  useEffect(() => { setRenderCount(CHUNK); }, [windowKey ?? applications.length, config.visible.join('|')]);
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || renderCount >= applications.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setRenderCount((c) => Math.min(c + CHUNK, applications.length));
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [renderCount, applications.length]);
  const rendered = applications.slice(0, renderCount);

  // Action-Feed jump support: grow the window until the target row is mounted,
  // then scroll it into view once and hand control back to the parent.
  useEffect(() => {
    if (!ensureVisibleId) return;
    const idx = applications.findIndex((a) => a.id === ensureVisibleId);
    if (idx >= 0 && idx >= renderCount) {
      setRenderCount(Math.min(idx + 10, applications.length));
      return; // re-runs after the window grows
    }
    const el = document.getElementById(`app-row-${ensureVisibleId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onEnsuredVisible?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureVisibleId, renderCount, applications]);

  // Keyboard navigation: rows are focusable; ↑/↓ move focus, Enter opens. We drive
  // focus off the DOM (rows carry data-row-index) so no extra render state is needed.
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const focusRow = (idx: number) => {
    const rows = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row-index]');
    if (!rows || rows.length === 0) return;
    const clamped = Math.max(0, Math.min(idx, rows.length - 1));
    rows[clamped]?.focus();
  };
  const onRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, idx: number, id: string) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(idx - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); onSelect(id); }
    else if (e.key === ' ' && selectable) { e.preventDefault(); onToggleSelect?.(id); }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="pipeline-table w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {selectable && (
              <th className="w-9 px-3 py-2 text-left">
                <input type="checkbox" checked={!!allSelected}
                  onChange={(e) => onToggleSelectAll?.(allIds, e.target.checked)} title="Select all shown" />
              </th>
            )}
            {visible.map((col) => {
              const opts = facets?.[col.key];
              const showFilter = isFilterable(col.key) && !!opts && opts.length > 0 && !!onColumnFilterChange;
              return (
                <th key={col.key} className={'px-3 py-2 text-left font-medium ' + classFor(col.key) + (col.align === 'right' ? ' text-right' : '')}>
                  <div className={'flex items-center gap-1 ' + (col.align === 'right' ? 'justify-end' : '')}>
                    <span>{col.label}</span>
                    {showFilter && (
                      <ColumnFilterButton
                        label={col.label}
                        options={opts!}
                        selected={columnFilters?.[col.key] ?? []}
                        onChange={(vals) => onColumnFilterChange!(col.key, vals)}
                      />
                    )}
                  </div>
                </th>
              );
            })}
            {showCreditScan && <th className="px-2 py-2 text-left font-medium" title="Credit check status + CarTrust Credit Report Scan">Credit Check</th>}
            <th className="w-9 px-2 py-2" title="Open the full application (Deal Room)" />
          </tr>
        </thead>
        <tbody ref={tbodyRef} className="divide-y divide-border">
          {rendered.map((a, idx) => {
            const isSelected = selectedIds?.has(a.id);
            const busy = busyByApp?.get(a.id);
            return (
              <tr key={a.id} id={`app-row-${a.id}`} data-row-index={idx} tabIndex={0} onClick={() => onSelect(a.id)}
                onKeyDown={(e) => onRowKeyDown(e, idx, a.id)}
                className={'cursor-pointer transition hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ' + (isSelected ? 'bg-primary/10' : '') + ' ' + (rowClassName?.(a) || '')}
                style={busy ? { boxShadow: `inset 4px 0 0 0 ${busy.color}`, backgroundColor: isSelected ? undefined : `${busy.color}14` } : undefined}
                title={busy ? `${busy.name} is viewing this profile` : undefined}>
                {selectable && (
                  <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.(a.id)} />
                  </td>
                )}
                {visible.map((col) => (
                  <td key={col.key} className={'px-3 py-2 align-top ' + classFor(col.key) + (col.align === 'right' ? ' text-right tabular-nums' : '')}>
                    {renderExtraCell?.(col.key, a)
                      ?? (col.key === 'status' && statusSelect
                        ? <InlineStatusSelect app={a} statusSelect={statusSelect} theme={theme} />
                        : renderCell(col.key, a, busy, onChangeStatus, statusLabels, statusStyles, theme, {
                            clientLabels, clientStyles, timerStatuses, now,
                          }))}
                  </td>
                ))}
                {/* Mirrors the Finance summary's credit-check cell exactly:
                    status dropdown + CarTrust scan button side by side. */}
                {showCreditScan && (
                  <td className="px-2 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const cc = (a as any).credit_check_status as 'passed' | 'failed' | 'pending' | null | undefined;
                        const ccStyle =
                          cc === 'passed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : cc === 'failed'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : cc === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-muted/40 text-muted-foreground border-border';
                        return (
                          <Select
                            value={cc || ''}
                            onValueChange={async (v) => {
                              if (v === 'pending') {
                                try {
                                  await updateApplication.mutateAsync({ id: a.id, updates: { credit_check_status: 'pending' } as any });
                                } catch { /* hook toasts */ }
                                return;
                              }
                              onCreditCheckOutcome?.(a, v as 'passed' | 'failed');
                            }}
                          >
                            <SelectTrigger className={`w-[130px] h-7 text-xs uppercase tracking-wider border ${ccStyle}`}>
                              <SelectValue placeholder="Not Run" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                              <SelectItem value="passed" className="text-xs">Passed</SelectItem>
                              <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      })()}
                      <CreditScanButton application={a} />
                    </div>
                  </td>
                )}
                {/* Always-available jump into the full application detail (Deal Room). */}
                <td className="px-2 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <Link
                    to={`/admin/finance/${a.id}`}
                    title="Open full application (Deal Room)"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
          {renderCount < applications.length && (
            <tr ref={sentinelRef}>
              <td colSpan={visible.length + (selectable ? 1 : 0) + (showCreditScan ? 1 : 0) + 1} className="py-3 text-center text-xs text-muted-foreground">
                Showing {renderCount} of {applications.length} — scroll for more…
              </td>
            </tr>
          )}
          {applications.length === 0 && (
            <tr>
              <td colSpan={visible.length + (selectable ? 1 : 0) + (showCreditScan ? 1 : 0) + 1} className="py-10 text-center text-sm text-muted-foreground">
                No applications match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Subtle header filter control (shadcn faceted-filter pattern): a small muted
 * ListFilter icon that opens a Popover with a scrollable, multi-select checkbox
 * list of the column's DISTINCT values (with counts). A badge shows how many
 * values are selected. stopPropagation keeps clicks off any header sort/handler.
 */
function ColumnFilterButton({
  label, options, selected, onChange,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const active = selected.length > 0;
  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={`Filter ${label}`}
          aria-label={`Filter ${label}`}
          className={cn(
            'relative -my-1 inline-flex h-5 w-5 items-center justify-center rounded-sm transition',
            active
              ? 'text-foreground'
              : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
          )}
        >
          <ListFilter className="h-3.5 w-3.5" />
          {active && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
              {selected.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {active && (
            <button
              type="button"
              className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          )}
        </div>
        <div className="max-h-60 space-y-0.5 overflow-y-auto pr-0.5">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggle(opt.value, v === true)}
                  aria-label={opt.label}
                />
                <span className="flex-1 truncate normal-case">{opt.label}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{opt.count}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <div className="px-1 py-2 text-xs text-muted-foreground">No values</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Finance-style inline status dropdown (used when the parent passes `statusSelect`).
 *  Byte-equal look to the old hand-rolled Finance table's status cell, wired to the
 *  page's interceptor chain (bank-ref modal → comment gate → hook). */
function InlineStatusSelect({
  app, statusSelect, theme,
}: {
  app: FinanceApplication;
  statusSelect: {
    options: (app: FinanceApplication) => { value: string; label: string }[];
    onChange: (app: FinanceApplication, status: string) => void;
  };
  theme: 'light' | 'dark';
}) {
  const any = app as any;
  const stamp = any.status_updated_at || any.updated_at;
  const tip = stamp
    ? `Changed: ${new Date(stamp).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date(stamp).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : undefined;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={any.status} onValueChange={(v) => statusSelect.onChange(app, v)}>
        <SelectTrigger
          title={tip}
          className={`w-[180px] h-7 text-xs uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(any.status, theme) || statusBadgeClass('pending', theme)}`}
        >
          <SelectValue>
            <span className="whitespace-nowrap">{ADMIN_STATUS_LABELS[any.status] || any.status}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusSelect.options(app).map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {ADMIN_STATUS_LABELS[opt.value] || opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Which timestamp drives the time-in-status timer for this row, and from which
 * track. Client status wins when it's timer-enabled AND has a stamped time
 * (client_status_updated_at); otherwise the finance status if IT is timer-enabled
 * (status_updated_at, falling back to updated_at for the ~10 legacy rows that
 * predate the stamp trigger). Returns null when neither status has a timer.
 */
function resolveTimer(
  a: any,
  timerStatuses?: Set<string>,
): { since: string; track: 'client' | 'finance' } | null {
  if (!timerStatuses || timerStatuses.size === 0) return null;
  const cs = a.client_status;
  if (cs && timerStatuses.has(cs) && a.client_status_updated_at) {
    return { since: a.client_status_updated_at, track: 'client' };
  }
  const fs = a.status;
  if (fs && timerStatuses.has(fs)) {
    const since = a.status_updated_at || a.updated_at;
    if (since) return { since, track: 'finance' };
  }
  return null;
}

function renderCell(
  key: string, a: FinanceApplication, busy: Busy | undefined,
  onChangeStatus?: (app: FinanceApplication, track?: 'finance' | 'client') => void,
  statusLabels?: Record<string, string>,
  statusStyles?: Record<string, string>,
  theme: 'light' | 'dark' = 'dark',
  client?: {
    clientLabels: Record<string, string>;
    clientStyles: Record<string, string>;
    /** Slugs (both tracks) that should paint a time-in-status timer. */
    timerStatuses?: Set<string>;
    /** Shared clock (ms) so every row's timer reads off the same tick. */
    now?: number;
  },
): React.ReactNode {
  const any = a as any;
  switch (key) {
    case 'applicant':
      return (
        <>
          <div className="font-semibold text-foreground">{appName(a)}</div>
          <div className="text-xs text-muted-foreground truncate">{any.email || ''}</div>
          {busy && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: busy.color }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/90" />
              {busy.name} is in this profile
            </div>
          )}
        </>
      );
    case 'status': {
      const cls = statusStyles?.[any.status] || statusBadgeClass(any.status, theme) || 'bg-muted text-muted-foreground border-border';
      const label = statusLabels?.[any.status] || ADMIN_STATUS_LABELS[any.status] || any.status || '—';
      return onChangeStatus ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onChangeStatus(a); }} title="Click to change status"
          className={'rounded border px-1.5 py-0.5 text-xs font-semibold transition hover:brightness-110 ' + cls}>
          {label}
        </button>
      ) : (
        <span className={'rounded border px-1.5 py-0.5 text-xs font-semibold ' + cls}>{label}</span>
      );
    }
    case 'client_status': {
      // Badge button mirroring `case 'status'`, but for the client track. Clicking it
      // opens the Change-status modal on the Client tab; the write still goes through
      // the modal's isolated client-status path (no lane move, no notifications).
      const slug = any.client_status || '';
      const hasStatus = !!slug;
      const cls = hasStatus
        ? (client?.clientStyles?.[slug] || 'bg-muted text-muted-foreground border-border')
        : 'bg-transparent text-muted-foreground/60 border-dashed border-border';
      const label = hasStatus ? (client?.clientLabels?.[slug] || slug) : 'Set status';
      return onChangeStatus ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onChangeStatus(a, 'client'); }}
          title="Click to change client status"
          className={'rounded border px-1.5 py-0.5 text-xs font-semibold transition hover:brightness-110 ' + cls}>
          {label}
        </button>
      ) : (
        <span className={'rounded border px-1.5 py-0.5 text-xs font-semibold ' + cls}>{label}</span>
      );
    }
    case 'timer': {
      // Time-in-status timer. Client status wins when it's timer-enabled and has a
      // timestamp, else the finance status (owner 2026-07-23). Renders nothing (a
      // faint dash) for statuses without a timer, so the column is quiet until the
      // admin opts statuses in. Colour buckets: 0–5h green, 5–14h amber, 14h+ red.
      const t = resolveTimer(any, client?.timerStatuses);
      if (!t) return <span className="text-muted-foreground/30">—</span>;
      const started = new Date(t.since).getTime();
      if (Number.isNaN(started)) return <span className="text-muted-foreground/30">—</span>;
      const elapsed = Math.max(0, (client?.now ?? Date.now()) - started);
      const bucket = timerBucket(elapsed);
      const statusLabel = t.track === 'client'
        ? (client?.clientLabels?.[any.client_status] || any.client_status || 'client status')
        : (statusLabels?.[any.status] || ADMIN_STATUS_LABELS[any.status] || any.status || 'status');
      const sinceStr = `${formatDate(t.since)} ${formatTime(t.since)}`.trim();
      const tip = `In "${statusLabel}" for ${formatDuration(elapsed)}${sinceStr ? ` — since ${sinceStr}` : ''}`;
      return (
        <span title={tip}
          className={'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums ' + TIMER_BUCKET_CLASS[bucket]}>
          {formatDuration(elapsed)}
        </span>
      );
    }
    case 'internal': {
      // The single NEWEST USER note across BOTH systems (structured pipeline
      // notes + the Finance CRM popup's legacy blob) — owner rule 2026-07-17:
      // one note per client, and blob-only notes must not vanish. System/event
      // notes (client-status auto-notes, WhatsApp-send logs — see
      // SYSTEM_NOTE_CATEGORIES) are skipped and NO category chips render here
      // (owner 2026-07-18: "Notes are for the notes left by the user"; chips
      // read like client statuses — fix/client-status-note-trap). The drawer
      // feed still shows every note with its tag. Falls back to the directed
      // internal-status label, then to nothing.
      const latest = latestUserNote(a);
      if (latest) {
        return (
          <div className="space-y-0.5">
            <div className="line-clamp-2 text-xs text-foreground">{latest.body}</div>
            <div className="text-[10px] text-muted-foreground">
              {latest.author_name || 'Unknown'}
              {latest.created_at
                ? ` · ${relativeTime(latest.created_at)}`
                : latest.legacyStamp ? ` · ${latest.legacyStamp}` : ''}
            </div>
          </div>
        );
      }
      const k = (normalizeInternalStatus(any.internal_status) || 'no_notes') as InternalStatus;
      const lbl = INTERNAL_STATUSES[k]?.label;
      return k === 'no_notes' ? <span className="text-xs text-muted-foreground/50">—</span>
        : <span className="text-xs text-foreground">{lbl}</span>;
    }
    case 'phone': return <span className="whitespace-nowrap tabular-nums">{formatPhone(any.phone)}</span>;
    case 'email': return <span className="text-xs">{any.email || '—'}</span>;
    case 'id_number': return <span className="font-mono text-xs">{any.id_number || '—'}</span>;
    case 'vehicle':
      return a.vehicle ? <span className="text-xs">{a.vehicle.year} {a.vehicle.make} {a.vehicle.model}</span>
        : <span className="text-xs text-muted-foreground/50">{any.preferred_vehicle_text || '—'}</span>;
    case 'bank': return <span>{any.bank_name || '—'}</span>;
    case 'gross': return formatCurrencyR(any.gross_salary);
    case 'net': return formatCurrencyR(any.net_salary);
    case 'deposit': return formatCurrencyR(any.deposit_amount);
    case 'fni': return <span className="text-xs">{a.fni_owner?.full_name || a.fni_owner?.email || '—'}</span>;
    case 'rep': return <span className="text-xs">{a.creator?.full_name || a.creator?.email || '—'}</span>;
    case 'bank_reference': return <span className="font-mono text-xs">{any.bank_reference || '—'}</span>;
    case 'deal_type': return <span className="text-xs capitalize">{any.deal_type || '—'}</span>;
    case 'source':
      return (
        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {sourceLabel(any.submission_source)}
        </span>
      );
    case 'created':
      return (
        <div className="whitespace-nowrap text-muted-foreground tabular-nums">
          <div>{formatDate(any.created_at) || '—'}</div>
          {formatTime(any.created_at) && <div className="text-[10px] opacity-60">{formatTime(any.created_at)}</div>}
        </div>
      );
    case 'credit': {
      // Read-only credit-check STATUS badge for the toggleable 'credit' column
      // (visible on non-intake tabs). The interactive dropdown + CarTrust scan
      // stays exclusive to the intake `showCreditScan` cell; here we only surface
      // the status. Colour mapping is byte-equal to that cell's `ccStyle` so the
      // two read as one control.
      const cc = any.credit_check_status as 'passed' | 'failed' | 'pending' | null | undefined;
      const ccStyle =
        cc === 'passed'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : cc === 'failed'
            ? 'bg-red-500/10 text-red-400 border-red-500/30'
            : cc === 'pending'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-muted/40 text-muted-foreground border-border';
      const ccLabel =
        cc === 'passed' ? 'Passed'
          : cc === 'failed' ? 'Failed'
            : cc === 'pending' ? 'Pending'
              : 'Not run';
      return (
        <span className={'inline-flex items-center rounded border px-2 py-0.5 text-xs uppercase tracking-wider ' + ccStyle}>
          {ccLabel}
        </span>
      );
    }
    default: return null;
  }
}
