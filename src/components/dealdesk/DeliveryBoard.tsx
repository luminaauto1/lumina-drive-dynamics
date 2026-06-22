import { useMemo } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Deal } from '@/lib/dealdesk/types';
import { natisStatus, isNatisAttention } from '@/lib/dealdesk/natis';
import { formatDate } from '@/lib/dealdesk/format';
import { NatisChip } from './badges';
import { useDeskSettings, useMarkNatisSent } from '@/hooks/dealdesk/useDealDesk';

function DealCard({ deal, onOpen }: { deal: Deal; onOpen: (d: Deal) => void }) {
  const { data: settings } = useDeskSettings();
  const markNatis = useMarkNatisSent();
  const natis = natisStatus(deal, settings);
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <button className="text-left" onClick={() => onOpen(deal)}>
          <div className="font-medium text-sm hover:underline">{deal.client_name || '—'}</div>
          <div className="text-xs text-muted-foreground">{deal.vehicle_make_model || '—'}</div>
        </button>
        <NatisChip status={natis} />
      </div>
      <div className="text-[11px] text-muted-foreground">Delivered {formatDate(deal.delivery_date) || '—'}</div>
      <Button size="sm" variant="outline" className="h-7 w-full" disabled={markNatis.isPending}
        onClick={() => markNatis.mutate({ dealId: deal.id, sent: true })}>
        Mark Natis sent
      </Button>
    </div>
  );
}

export function DeliveryBoard({ deals, onOpen }: { deals: Deal[]; onOpen: (d: Deal) => void }) {
  const { data: settings } = useDeskSettings();

  const { urgent, onTrack } = useMemo(() => {
    const active = deals
      .filter((d) => d.deal_status === 'delivered' && !d.natis_sent && d.delivery_date)
      .map((d) => ({ d, s: natisStatus(d, settings) }))
      .sort((a, b) => (a.s.daysLeft ?? 999) - (b.s.daysLeft ?? 999));
    return {
      urgent: active.filter((x) => isNatisAttention(x.s, settings)).map((x) => x.d),
      onTrack: active.filter((x) => !isNatisAttention(x.s, settings)).map((x) => x.d),
    };
  }, [deals, settings]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div>
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-red-400">
          <AlertTriangle className="w-4 h-4" /> Urgent — Natis ({urgent.length})
        </div>
        <div className="space-y-2">
          {urgent.length === 0 ? <p className="text-sm text-muted-foreground">Nothing urgent. 🎉</p>
            : urgent.map((d) => <DealCard key={d.id} deal={d} onOpen={onOpen} />)}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-400">
          <Clock className="w-4 h-4" /> On track ({onTrack.length})
        </div>
        <div className="space-y-2">
          {onTrack.length === 0 ? <p className="text-sm text-muted-foreground">No delivered deals awaiting Natis.</p>
            : onTrack.map((d) => <DealCard key={d.id} deal={d} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  );
}
