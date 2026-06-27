import type { DealStage } from '@/lib/dealdesk/types';
import { NATIS_CHIP_CLASS, type NatisStatus } from '@/lib/dealdesk/natis';
import { cn } from '@/lib/utils';
import { StatusBadge as SharedStatusBadge } from '@/components/admin/StatusBadge';

/**
 * Deal Desk status badge — now driven by the shared two-track <StatusBadge> on the
 * 'deal' track (labels/colours from the deal-stage config), instead of the old
 * hardcoded DEAL_STATUS_CLASS map. Kept as a thin wrapper so existing Deal Desk
 * imports keep working; it renders the deal-STAGE track value.
 */
export function StatusBadge({ stage }: { stage: DealStage }) {
  return <SharedStatusBadge track="deal" value={stage} />;
}

export function NatisChip({ status }: { status: NatisStatus }) {
  if (status.tone === 'none') return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-semibold', NATIS_CHIP_CLASS[status.tone])}>
      {status.label}
    </span>
  );
}
