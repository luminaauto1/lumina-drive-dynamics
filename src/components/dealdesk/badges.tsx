import type { DealStatus } from '@/lib/dealdesk/types';
import { DEAL_STATUS_LABEL } from '@/lib/dealdesk/types';
import { NATIS_CHIP_CLASS, type NatisStatus } from '@/lib/dealdesk/natis';
import { cn } from '@/lib/utils';

const DEAL_STATUS_CLASS: Record<DealStatus, string> = {
  contract_signed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  invoiced:        'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  delivered:       'bg-amber-500/15 text-amber-400 border-amber-500/30',
  cleared:         'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled:       'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <span className={cn('inline-block rounded border px-1.5 py-0.5 text-xs font-semibold', DEAL_STATUS_CLASS[status])}>
      {DEAL_STATUS_LABEL[status]}
    </span>
  );
}

export function NatisChip({ status }: { status: NatisStatus }) {
  if (status.tone === 'none') return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-semibold', NATIS_CHIP_CLASS[status.tone])}>
      {status.label}
    </span>
  );
}
