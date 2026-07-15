// Generic work-queue panel (redesign P2). One of these renders per QueueDef —
// header with count + SLA badge, collapsible rows with the client, status,
// age-in-status, docs checklist and the queue's one-click next actions.
// Successor of DocsChasePanel / FlexiDealsPanel (behavior preserved).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, ExternalLink, PhoneCall, FileCheck2, Landmark,
  BadgeCheck, CheckCircle2, ThumbsDown, ScanSearch, ClipboardList, PackageCheck,
  FileSignature, Hourglass, AlertTriangle, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMIN_STATUS_LABELS, statusBadgeClass } from '@/lib/statusConfig';
import type { QueueDef, QueueAction } from '@/lib/finance/queues';
import { isContactFresh } from '@/lib/finance/shared';
import { slaHoursFor } from '@/lib/finance/sla';
import { AgeChip } from './AgeChip';
import { DocsChecklistChip } from './DocsChecklistChip';
import { CreditScanButton } from '@/components/finance/CreditScanButton';

const QUEUE_ICONS: Record<QueueDef['icon'], any> = {
  scan: ScanSearch,
  load: Upload,
  package: PackageCheck,
  bank: Landmark,
  chase: ClipboardList,
  docs: FileCheck2,
  validate: BadgeCheck,
  contract: FileSignature,
  flexi: Landmark,
  stalled: AlertTriangle,
};

const ACTION_ICONS: Record<QueueAction['icon'], any> = {
  check: CheckCircle2,
  bank: Landmark,
  approve: BadgeCheck,
  decline: ThumbsDown,
  docs_in: FileCheck2,
  validated: BadgeCheck,
  contacted: PhoneCall,
  contract: FileSignature,
};

const relTime = (iso?: string | null) => {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const clientName = (a: any) =>
  a.full_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || '—';

export function QueuePanel({
  def,
  apps,
  busyId,
  onAction,
  defaultOpen = true,
  chrome = 'panel',
}: {
  def: QueueDef;
  apps: any[];
  busyId: string | null;
  onAction: (app: any, action: QueueAction) => void | Promise<void>;
  defaultOpen?: boolean;
  /** 'panel' = standalone collapsible card (legacy). 'bare' = rows only with a
   *  slim hint line — used inside the tabbed My Work bar (owner: "make it like
   *  the pipeline"), where the tab itself is the header. */
  chrome?: 'panel' | 'bare';
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);
  // Render cap — a queue can legitimately hold dozens of rows (e.g. Stalled),
  // but mounting them all at once is the render-all mistake that used to crash
  // the page. Header badge always shows the TRUE count.
  const [showAll, setShowAll] = useState(false);
  if (apps.length === 0) return null;

  const CAP = 12;
  const visible = showAll ? apps : apps.slice(0, CAP);
  const Icon = QUEUE_ICONS[def.icon] || Hourglass;
  const slaH = def.slaStatus != null ? slaHoursFor(def.slaStatus) : null;

  // One row — shared by the standalone panel and the tabbed (bare) rendering.
  const renderRow = (a: any) => {
    const fresh = isContactFresh(a);
    return (
      <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <div className="min-w-[150px]">
          <div className="text-sm font-medium text-foreground truncate">{clientName(a)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{a.phone || '—'}</div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadgeClass(a.status)}`}>
          {ADMIN_STATUS_LABELS[a.status] || a.status}
        </span>
        <AgeChip app={a} />
        {def.showDocsChecklist && <DocsChecklistChip app={a} />}
        {def.showContactStatus && (
          <span className={`text-[11px] whitespace-nowrap ${fresh ? 'text-emerald-400' : 'text-amber-400'}`}>
            {fresh
              ? `✓ contacted ${relTime(a.docs_contacted_at)}${a.docs_contacted_by ? ` by ${a.docs_contacted_by}` : ''}`
              : a.docs_contacted_at
                ? `⚠ last contact ${relTime(a.docs_contacted_at)} — chase again`
                : '⚠ never contacted'}
          </span>
        )}
        {a.fni_owner?.full_name && (
          <span className="text-[11px] text-zinc-500 whitespace-nowrap hidden lg:inline">
            F&I: {a.fni_owner.full_name}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {def.showCreditScan && <CreditScanButton application={a} />}
          {def.actions
            .filter((act) => (act.show ? act.show(a) : true))
            .map((act) => {
              const ActIcon = ACTION_ICONS[act.icon] || CheckCircle2;
              return (
                <Button
                  key={act.key}
                  size="sm"
                  variant="outline"
                  className={`h-7 gap-1 ${act.className || ''}`}
                  disabled={busyId === a.id}
                  onClick={() => void onAction(a, act)}
                  title={act.title || act.label}
                >
                  <ActIcon className="w-3.5 h-3.5" /> {act.label}
                </Button>
              );
            })}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => navigate(`/admin/finance/${a.id}`)}
            title="Open full application"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (chrome === 'bare') {
    return (
      <div>
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <span className="text-[11px] text-zinc-500">{def.hint}</span>
          {slaH != null && (
            <span className="text-[10px] text-zinc-600 whitespace-nowrap">SLA {slaH}h</span>
          )}
        </div>
        <div className="divide-y divide-zinc-800/70">
          {visible.map((a: any) => renderRow(a))}
          {apps.length > CAP && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="w-full px-4 py-2 text-left text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAll ? '▲ Show fewer' : `▼ Show all ${apps.length}`}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#161616] border border-zinc-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${def.accent}`} />
          <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium truncate">
            {def.title}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border tabular-nums ${def.key === 'stalled' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-zinc-800/80 text-zinc-300 border-zinc-700'}`}>
            {apps.length}
          </span>
          <span className="text-[11px] text-zinc-600 truncate hidden md:inline">{def.hint}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {slaH != null && (
            <span className="text-[10px] text-zinc-600 whitespace-nowrap">SLA {slaH}h</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-zinc-800/70 border-t border-zinc-800">
          {visible.map((a: any) => renderRow(a))}
          {apps.length > CAP && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="w-full px-4 py-2 text-left text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAll ? '▲ Show fewer' : `▼ Show all ${apps.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
