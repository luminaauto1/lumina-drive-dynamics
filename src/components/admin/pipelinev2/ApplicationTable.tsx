import { useRef } from 'react';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_STYLES, ADMIN_STATUS_LABELS, statusBadgeClass } from '@/lib/statusConfig';
import { useDeskTheme } from '@/hooks/useDeskTheme';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { INTERNAL_STATUSES, normalizeInternalStatus, type InternalStatus } from '@/lib/internalStatusConfig';
import { formatCurrencyR, formatDate, formatTime, formatPhone, relativeTime } from '@/lib/pipelinev2/format';
import { TABLE_COLUMNS, columnClass, type TableConfig } from '@/lib/pipelinev2/columns';
import { sourceLabel } from '@/lib/pipelinev2/source';
import { latestPipelineNote, noteCategory } from '@/lib/pipelinev2/notes';

interface Busy { userId: string; name: string; color: string }

const appName = (a: FinanceApplication) =>
  (a as any).full_name || [(a as any).first_name, (a as any).last_name].filter(Boolean).join(' ') || '—';

export function ApplicationTable({
  applications, config, onSelect, onChangeStatus,
  selectable, selectedIds, onToggleSelect, onToggleSelectAll, busyByApp,
  statusLabels, statusStyles,
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
}) {
  const { theme } = useDeskTheme();
  // Client-status track (DB-driven, customizable). Only the label/colour maps are
  // needed now: the cell renders a badge button and the actual write happens in the
  // Change-status modal (Client tab), so no mutation is wired here anymore.
  const { clientLabels, clientStyles } = useStatusConfig();
  const colByKey = new Map(TABLE_COLUMNS.map((c) => [c.key, c]));
  const visible = config.visible.map((k) => colByKey.get(k)).filter(Boolean) as TableColumnDef[];
  type TableColumnDef = (typeof TABLE_COLUMNS)[number];

  const classFor = (key: string) => {
    const def = colByKey.get(key);
    return columnClass(def, config.widths[key] ?? def?.defaultWidth ?? 'normal');
  };
  const allIds = applications.map((a) => a.id);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));

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
            {visible.map((col) => (
              <th key={col.key} className={'px-3 py-2 text-left font-medium ' + classFor(col.key) + (col.align === 'right' ? ' text-right' : '')}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={tbodyRef} className="divide-y divide-border">
          {applications.map((a, idx) => {
            const isSelected = selectedIds?.has(a.id);
            const busy = busyByApp?.get(a.id);
            return (
              <tr key={a.id} data-row-index={idx} tabIndex={0} onClick={() => onSelect(a.id)}
                onKeyDown={(e) => onRowKeyDown(e, idx, a.id)}
                className={'cursor-pointer transition hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ' + (isSelected ? 'bg-primary/10' : '')}
                style={busy ? { boxShadow: `inset 4px 0 0 0 ${busy.color}`, backgroundColor: isSelected ? undefined : `${busy.color}14` } : undefined}
                title={busy ? `${busy.name} is viewing this profile` : undefined}>
                {selectable && (
                  <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.(a.id)} />
                  </td>
                )}
                {visible.map((col) => (
                  <td key={col.key} className={'px-3 py-2 align-top ' + classFor(col.key) + (col.align === 'right' ? ' text-right tabular-nums' : '')}>
                    {renderCell(col.key, a, busy, onChangeStatus, statusLabels, statusStyles, theme, {
                      clientLabels, clientStyles,
                    })}
                  </td>
                ))}
              </tr>
            );
          })}
          {applications.length === 0 && (
            <tr>
              <td colSpan={visible.length + (selectable ? 1 : 0)} className="py-10 text-center text-sm text-muted-foreground">
                No applications match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
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
    case 'internal': {
      // Prefer the most recent structured pipeline note (with author + time);
      // fall back to the directed internal-status label, then to nothing.
      const latest = latestPipelineNote(a);
      if (latest) {
        const cat = noteCategory(latest.category);
        return (
          <div className="space-y-0.5">
            {latest.category !== 'note' && (
              <span className={'inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ' + cat.color}>
                {cat.label}{cat.emoji ? ` ${cat.emoji}` : ''}
              </span>
            )}
            <div className="line-clamp-2 text-xs text-foreground">{latest.body}</div>
            <div className="text-[10px] text-muted-foreground">
              {latest.author_name || 'Unknown'}{latest.created_at ? ` · ${relativeTime(latest.created_at)}` : ''}
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
    default: return null;
  }
}
