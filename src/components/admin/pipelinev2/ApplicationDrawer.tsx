import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_STYLES, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';
import { formatCurrencyR, formatPhone, formatPhoneIntl, formatDate } from '@/lib/pipelinev2/format';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useUpdateApplicationSource } from '@/hooks/useFinanceApplications';
import { SOURCE_OPTIONS, sourceLabel } from '@/lib/pipelinev2/source';
import { NotesFeed } from './NotesFeed';
import { HistoryFeed } from './HistoryFeed';
import { CreditCheckAttachment } from './CreditCheckAttachment';

const appName = (a: FinanceApplication) =>
  (a as any).full_name || [(a as any).first_name, (a as any).last_name].filter(Boolean).join(' ') || 'Applicant';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words">{value ?? '—'}</div>
    </div>
  );
}

export function ApplicationDrawer({
  app, onClose, onChangeStatus,
}: {
  app: FinanceApplication | null;
  onClose: () => void;
  onChangeStatus: (app: FinanceApplication) => void;
}) {
  const [feed, setFeed] = useState<'notes' | 'history'>('notes');
  const { clientLabels, clientStyles } = useStatusConfig();
  const updateSource = useUpdateApplicationSource();
  const navigate = useNavigate();
  if (!app) return null;
  const any = app as any;
  const phoneIntl = formatPhoneIntl(any.phone);
  const copyPhone = async () => {
    if (!any.phone) return;
    try {
      await navigator.clipboard.writeText(phoneIntl);
      toast.success('Phone number copied');
    } catch {
      toast.error('Could not copy');
    }
  };
  // Map the stored source onto a set-able slug for the dropdown's value.
  // Legacy server value 'whatsapp_parser' shows selected as WhatsApp.
  const rawSource = String(any.submission_source ?? '').trim().toLowerCase();
  const sourceSlug = rawSource === 'whatsapp_parser' ? 'whatsapp'
    : SOURCE_OPTIONS.some((o) => o.value === rawSource) ? rawSource
    : undefined;
  const statusCls = STATUS_STYLES[any.status] || 'bg-muted text-muted-foreground border-border';
  const vehicleText = app.vehicle
    ? `${app.vehicle.year} ${app.vehicle.make} ${app.vehicle.model}`
    : any.preferred_vehicle_text || null;

  return (
    <Sheet open={!!app} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{appName(app)}</span>
            <span className={'shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ' + statusCls}>
              {ADMIN_STATUS_LABELS[any.status] || any.status || '—'}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onChangeStatus(app)}>
              <RefreshCw className="w-3.5 h-3.5" /> Change status
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { onClose(); navigate(`/admin/finance/${app.id}`); }}>
              <ExternalLink className="w-3.5 h-3.5" /> Finance View
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Fires the same WhatsApp / email / CRM notifications as the Finance page.
          </p>
          {/* Client status — read-only badge; edited via the Change-status modal. */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Client status</span>
            <StatusBadge track="client" value={any.client_status} labelOverrides={clientLabels} styleOverrides={clientStyles} />
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Phone" value={
            any.phone ? (
              <button type="button" onClick={copyPhone}
                title="Click to copy"
                className="inline-flex items-center gap-1 text-sm text-foreground hover:text-primary hover:underline cursor-pointer">
                {phoneIntl}
                <Copy className="w-3 h-3 opacity-60" />
              </button>
            ) : '—'
          } />
          <Field label="Email" value={any.email || '—'} />
          <Field label="ID Number" value={any.id_number || '—'} />
          <Field label="Deal Type" value={any.deal_type ? <span className="capitalize">{any.deal_type}</span> : '—'} />
          <Field label="Source" value={
            <Select
              value={sourceSlug}
              onValueChange={(v) => updateSource.mutate({ id: app.id, submission_source: v })}
              disabled={updateSource.isPending}
            >
              <SelectTrigger className="h-7 w-full px-2 text-sm">
                <SelectValue placeholder={sourceLabel(any.submission_source)} />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          } />
          <Field label="Vehicle" value={vehicleText} />
          <Field label="Bank" value={any.bank_name || '—'} />
          <Field label="Bank Ref" value={any.bank_reference || '—'} />
          <Field label="Gross Salary" value={formatCurrencyR(any.gross_salary)} />
          <Field label="Deposit" value={formatCurrencyR(any.deposit_amount)} />
          <Field label="Created" value={formatDate(any.created_at)} />
          <Field label="F&I" value={app.fni_owner?.full_name || app.fni_owner?.email || '—'} />
          <Field label="Rep" value={app.creator?.full_name || app.creator?.email || '—'} />
        </div>

        <CreditCheckAttachment app={any} />

        <Separator className="my-4" />

        <div className="flex gap-1 mb-3">
          {(['notes', 'history'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setFeed(t)}
              className={'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                (feed === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'notes' ? 'Notes' : 'History'}
            </button>
          ))}
        </div>

        {feed === 'notes' ? <NotesFeed app={app} /> : <HistoryFeed app={app} />}
      </SheetContent>
    </Sheet>
  );
}
