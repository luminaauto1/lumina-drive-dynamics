import type { Deal } from '@/lib/dealdesk/types';
import { CONDITION_LABEL } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatRand, formatDate } from '@/lib/dealdesk/format';
import { StatusBadge, NatisChip } from '../badges';
import { StatusBadge as FinanceStatusBadge } from '@/components/admin/StatusBadge';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useDeskSettings } from '@/hooks/dealdesk/useDealDesk';
import { dealNetProfit } from '@/lib/dealMetrics';

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value ?? '—'}</div>
    </div>
  );
}

export function OverviewTab({ deal }: { deal: Deal }) {
  const { data: settings } = useDeskSettings();
  const { labels: financeLabels, styles: financeStyles } = useStatusConfig();
  const natis = natisStatus(deal, settings);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge stage={deal.deal_stage} />
        {deal.finance_status && (
          <FinanceStatusBadge track="finance" value={deal.finance_status}
            labelOverrides={financeLabels} styleOverrides={financeStyles} />
        )}
        <NatisChip status={natis} />
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Customer</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Cell label="Name" value={deal.client_name} />
          <Cell label="Phone" value={deal.client_phone} />
          <Cell label="ID Number" value={deal.client_id_number} />
          <Cell label="Email" value={deal.client_email} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vehicle</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Cell label="Make / Model" value={deal.vehicle_make_model} />
          <Cell label="Year" value={deal.vehicle_year} />
          <Cell label="VIN" value={deal.vehicle_vin} />
          <Cell label="Stock #" value={deal.vehicle_stock_no} />
          <Cell label="Condition" value={deal.condition ? CONDITION_LABEL[deal.condition] : '—'} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Deal</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Cell label="Ledger gross profit" value={<span className="font-semibold text-emerald-400">{formatRand(dealNetProfit(deal))}</span>} />
          <Cell label="Sold price" value={formatRand(deal.sold_price)} />
          <Cell label="Sale date" value={formatDate(deal.sale_date)} />
          <Cell label="Delivery date" value={formatDate(deal.delivery_date)} />
          <Cell label="Natis" value={<NatisChip status={natis} />} />
          <Cell label="Closed" value={deal.is_closed ? 'Yes' : 'No'} />
        </div>
      </div>

      {deal.notes && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Post-deal notes</div>
          <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
        </div>
      )}
    </div>
  );
}
