import { CheckCircle2, Truck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { Deal } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatRand, formatDate } from '@/lib/dealdesk/format';
import { NatisChip } from '../badges';
import { useDeskSettings, useDealChecklist, useSaveChecklist, useMarkNatisSent } from '@/hooks/dealdesk/useDealDesk';

export function DeliveryTab({ deal }: { deal: Deal }) {
  const { data: settings } = useDeskSettings();
  const { data: checklist } = useDealChecklist(deal.id);
  const saveChecklist = useSaveChecklist();
  const markNatis = useMarkNatisSent();
  const natis = natisStatus(deal, settings);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Truck className="w-4 h-4" /> Natis countdown</div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <NatisChip status={natis} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Delivery date</span><span>{formatDate(deal.delivery_date) || '—'}</span>
        </div>
        {natis.daysSinceDelivery != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Days since delivery</span><span>{natis.daysSinceDelivery}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm font-medium">Natis sent</span>
          <Switch checked={deal.natis_sent} disabled={markNatis.isPending}
            onCheckedChange={(v) => markNatis.mutate({ dealId: deal.id, sent: v })} />
        </div>
        {markNatis.isPending && <div className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin inline mr-1" />Updating…</div>}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className={'w-4 h-4 ' + (checklist?.delivery_ready ? 'text-emerald-400' : 'text-muted-foreground')} /> Delivery ready
        </span>
        <Switch checked={!!checklist?.delivery_ready} disabled={saveChecklist.isPending}
          onCheckedChange={(v) => saveChecklist.mutate({ dealId: deal.id, patch: { delivery_ready: v } })} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Ledger gross profit for this deal: <strong>{formatRand(deal.gross_profit)}</strong>. Marking Natis sent only updates the
        Deal Desk tracking columns — it does not change the deal's recorded profit.
      </p>
    </div>
  );
}
