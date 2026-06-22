import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_STYLES, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';
import { INTERNAL_STATUSES, normalizeInternalStatus, type InternalStatus } from '@/lib/internalStatusConfig';
import { formatCurrencyR, formatDate, formatTime, formatPhone } from '@/lib/pipelinev2/format';
import { TABLE_COLUMNS, columnClass, type TableConfig } from '@/lib/pipelinev2/columns';

interface Busy { userId: string; name: string; color: string }

const appName = (a: FinanceApplication) =>
  (a as any).full_name || [(a as any).first_name, (a as any).last_name].filter(Boolean).join(' ') || '—';

export function ApplicationTable({
  applications, config, onSelect, onChangeStatus,
  selectable, selectedIds, onToggleSelect, onToggleSelectAll, busyByApp,
}: {
  applications: FinanceApplication[];
  config: TableConfig;
  onSelect: (id: string) => void;
  onChangeStatus?: (app: FinanceApplication) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[], select: boolean) => void;
  busyByApp?: Map<string, Busy>;
}) {
  const colByKey = new Map(TABLE_COLUMNS.map((c) => [c.key, c]));
  const visible = config.visible.map((k) => colByKey.get(k)).filter(Boolean) as TableColumnDef[];
  type TableColumnDef = (typeof TABLE_COLUMNS)[number];

  const classFor = (key: string) => {
    const def = colByKey.get(key);
    return columnClass(def, config.widths[key] ?? def?.defaultWidth ?? 'normal');
  };
  const allIds = applications.map((a) => a.id);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
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
        <tbody className="divide-y divide-border">
          {applications.map((a) => {
            const isSelected = selectedIds?.has(a.id);
            const busy = busyByApp?.get(a.id);
            return (
              <tr key={a.id} onClick={() => onSelect(a.id)}
                className={'cursor-pointer transition hover:bg-muted/30 ' + (isSelected ? 'bg-primary/10' : '')}
                style={busy ? { boxShadow: `inset 4px 0 0 0 ${busy.color}`, backgroundColor: isSelected ? undefined : `${busy.color}14` } : undefined}
                title={busy ? `${busy.name} is viewing this profile` : undefined}>
                {selectable && (
                  <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.(a.id)} />
                  </td>
                )}
                {visible.map((col) => (
                  <td key={col.key} className={'px-3 py-2 align-top ' + classFor(col.key) + (col.align === 'right' ? ' text-right tabular-nums' : '')}>
                    {renderCell(col.key, a, busy, onChangeStatus)}
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
  onChangeStatus?: (app: FinanceApplication) => void,
): React.ReactNode {
  const any = a as any;
  switch (key) {
    case 'applicant':
      return (
        <>
          <div className="font-medium text-foreground">{appName(a)}</div>
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
      const cls = STATUS_STYLES[any.status] || 'bg-muted text-muted-foreground border-border';
      const label = ADMIN_STATUS_LABELS[any.status] || any.status || '—';
      return onChangeStatus ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onChangeStatus(a); }} title="Click to change status"
          className={'rounded border px-1.5 py-0.5 text-xs font-semibold transition hover:brightness-110 ' + cls}>
          {label}
        </button>
      ) : (
        <span className={'rounded border px-1.5 py-0.5 text-xs font-semibold ' + cls}>{label}</span>
      );
    }
    case 'internal': {
      const k = (normalizeInternalStatus(any.internal_status) || 'no_notes') as InternalStatus;
      const lbl = INTERNAL_STATUSES[k]?.label;
      return k === 'no_notes' ? <span className="text-xs text-muted-foreground/50">—</span>
        : <span className="text-xs text-foreground">{lbl}</span>;
    }
    case 'phone': return <span className="whitespace-nowrap">{formatPhone(any.phone)}</span>;
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
    case 'created':
      return (
        <div className="whitespace-nowrap text-muted-foreground">
          <div>{formatDate(any.created_at) || '—'}</div>
          {formatTime(any.created_at) && <div className="text-[10px] opacity-60">{formatTime(any.created_at)}</div>}
        </div>
      );
    default: return null;
  }
}
