import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote, Car, Check, IdCard, Mail, MessageCircle, Phone, Route, StickyNote, User,
} from 'lucide-react';
import type { Deal, DealStage } from '@/lib/dealdesk/types';
import { CONDITION_LABEL, DEAL_STAGE_LABEL } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatRand, formatDate, daysBetween, sastToday } from '@/lib/dealdesk/format';
import { StatusBadge, NatisChip } from '../badges';
import { StatusBadge as FinanceStatusBadge } from '@/components/admin/StatusBadge';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useDeskSettings } from '@/hooks/dealdesk/useDealDesk';
import { dealNetProfit } from '@/lib/dealMetrics';
import { cn } from '@/lib/utils';

/** Stage flow shown in the Progress strip ('none' excluded — it renders as nothing reached). */
const STAGE_FLOW: DealStage[] = ['deal_started', 'contract_signed', 'in_delivery', 'delivered', 'cleared'];

/** wa.me link for a SA phone number (leading 0 → 27). */
function waHref(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

function Card({ icon: Icon, title, className, children }: {
  icon: LucideIcon; title: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  const empty = value == null || value === '';
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('text-sm break-words', mono && 'font-mono', empty && 'text-muted-foreground/50')}>
        {empty ? '—' : value}
      </div>
    </div>
  );
}

export function OverviewTab({ deal }: { deal: Deal }) {
  const { data: settings } = useDeskSettings();
  const { labels: financeLabels, styles: financeStyles } = useStatusConfig();
  const natis = natisStatus(deal, settings);

  const gp = dealNetProfit(deal);
  const daysSinceDelivery = deal.delivery_date ? daysBetween(deal.delivery_date, sastToday()) : null;
  const stageIdx = STAGE_FLOW.indexOf(deal.deal_stage);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* ---- CLIENT ---- */}
      <Card icon={User} title="Client">
        <div className="space-y-3">
          <div className="text-sm font-semibold break-words">{deal.client_name || <span className="font-normal text-muted-foreground/50">—</span>}</div>
          <Field
            label="Phone"
            value={deal.client_phone && (
              <span className="flex items-center gap-2">
                <a href={`tel:${deal.client_phone}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {deal.client_phone}
                </a>
                <a
                  href={waHref(deal.client_phone)} target="_blank" rel="noopener noreferrer"
                  aria-label="WhatsApp" title="WhatsApp"
                  className="inline-flex text-emerald-400 hover:text-emerald-300"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </span>
            )}
          />
          <Field
            label="Email"
            value={deal.client_email && (
              <a href={`mailto:${deal.client_email}`} className="inline-flex items-center gap-1.5 break-all hover:underline">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {deal.client_email}
              </a>
            )}
          />
          <Field
            label="ID number"
            value={deal.client_id_number && (
              <span className="inline-flex items-center gap-1.5 font-mono">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                {deal.client_id_number}
              </span>
            )}
          />
        </div>
      </Card>

      {/* ---- VEHICLE ---- */}
      <Card icon={Car} title="Vehicle">
        <div className="space-y-3">
          <div className="text-sm font-semibold break-words">
            {deal.vehicle_make_model || <span className="font-normal text-muted-foreground/50">—</span>}
            {deal.vehicle_year && <span className="text-muted-foreground font-medium"> · {deal.vehicle_year}</span>}
          </div>
          <Field label="VIN" value={deal.vehicle_vin} mono />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Stock #" value={deal.vehicle_stock_no} mono />
            <Field
              label="Condition"
              value={deal.condition && (
                <span className="inline-block rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {CONDITION_LABEL[deal.condition]}
                </span>
              )}
            />
          </div>
        </div>
      </Card>

      {/* ---- DEAL ---- */}
      <Card icon={Banknote} title="Deal" className="sm:col-span-2">
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Ledger gross profit</div>
            <div className={cn('text-xl font-bold tabular-nums', gp < 0 ? 'text-red-400' : 'text-emerald-400')}>
              {formatRand(gp)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Field label="Sold price" value={deal.sold_price != null ? formatRand(deal.sold_price) : null} />
            <Field label="Cost basis" value={deal.cost_price != null ? formatRand(deal.cost_price) : null} />
            <Field label="Recon" value={deal.recon_cost != null ? formatRand(deal.recon_cost) : null} />
            <Field label="Sale date" value={formatDate(deal.sale_date)} />
            <Field
              label="Delivery date"
              value={deal.delivery_date && (
                <span>
                  {formatDate(deal.delivery_date)}
                  {daysSinceDelivery != null && daysSinceDelivery >= 0 && (
                    <span className="text-muted-foreground"> · {daysSinceDelivery === 0 ? 'today' : `${daysSinceDelivery}d ago`}</span>
                  )}
                </span>
              )}
            />
            <Field label="Natis" value={<NatisChip status={natis} />} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <StatusBadge stage={deal.deal_stage} />
            {deal.finance_status && (
              <FinanceStatusBadge track="finance" value={deal.finance_status}
                labelOverrides={financeLabels} styleOverrides={financeStyles} />
            )}
            <span className={cn(
              'inline-block rounded px-1.5 py-0.5 text-xs font-semibold border',
              deal.is_closed
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-muted text-muted-foreground border-border',
            )}>
              {deal.is_closed ? 'Closed' : 'Open'}
            </span>
          </div>
        </div>
      </Card>

      {/* ---- PROGRESS ---- */}
      <Card icon={Route} title="Progress" className="sm:col-span-2">
        <div className="flex items-center overflow-x-auto pb-1">
          {STAGE_FLOW.map((stage, i) => {
            const done = stageIdx > i;
            const current = stageIdx === i;
            return (
              <div key={stage} className="flex shrink-0 items-center">
                {i > 0 && <span className={cn('mx-2 h-px w-5', done || current ? 'bg-emerald-500/40' : 'bg-border')} />}
                <span className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border',
                  done && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
                  current && 'border-primary bg-primary/15 text-primary',
                  !done && !current && 'border-border bg-muted text-muted-foreground/40',
                )}>
                  {done ? <Check className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn(
                  'ml-1.5 whitespace-nowrap text-xs',
                  done && 'text-emerald-400',
                  current && 'font-medium text-foreground',
                  !done && !current && 'text-muted-foreground/60',
                )}>
                  {DEAL_STAGE_LABEL[stage]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4">
          <Field label="Created" value={formatDate(deal.created_at)} />
          <Field label="Sale" value={formatDate(deal.sale_date)} />
          <Field label="Delivery" value={formatDate(deal.delivery_date)} />
          <Field label="Natis sent" value={formatDate(deal.natis_sent_at)} />
        </div>
      </Card>

      {/* ---- POST-DEAL NOTES ---- */}
      {deal.notes && (
        <Card icon={StickyNote} title="Post-deal notes" className="sm:col-span-2">
          <p className="whitespace-pre-wrap text-sm">{deal.notes}</p>
        </Card>
      )}
    </div>
  );
}
