// FlexiDealsPanel — the NON-TRADITIONAL finance track (new bank partner,
// owner ask 2026-07-14). Its own section under the Finance tab: every
// application in Pre-Approved Flexi / Validated Flexi, with quick actions —
// these deals don't follow the traditional bank pipeline.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, ChevronDown, ChevronUp, ExternalLink, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateFinanceApplication, type FinanceApplication } from '@/hooks/useFinanceApplications';
import { ADMIN_STATUS_LABELS, STATUS_STYLES } from '@/lib/statusConfig';
import { useToast } from '@/hooks/use-toast';

const FLEXI_STATUSES = new Set(['pre_approved_flexi', 'validated_flexi']);

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) : '—';

export function FlexiDealsPanel({ applications }: { applications: FinanceApplication[] }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const updateApplication = useUpdateFinanceApplication();
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () => applications
      .filter((a: any) => FLEXI_STATUSES.has(a.status) && a.is_archived !== true)
      .sort((a: any, b: any) => (a.status === b.status ? 0 : a.status === 'pre_approved_flexi' ? -1 : 1)),
    [applications],
  );

  if (rows.length === 0) return null;

  const markValidated = async (app: any) => {
    setBusyId(app.id);
    try {
      await updateApplication.mutateAsync({ id: app.id, updates: { status: 'validated_flexi' } });
      toast({ title: 'Marked Validated Flexi', description: app.full_name || app.phone });
    } catch { /* hook toasts */ }
    finally { setBusyId(null); }
  };

  return (
    <div className="w-full bg-[#101a19] border border-teal-900/60 rounded-lg mb-4 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-teal-400" />
          <span className="text-[11px] uppercase tracking-[0.22em] text-teal-300/80 font-medium">
            Flexi Deals — Non-Traditional Finance
          </span>
          <span className="text-[11px] text-zinc-500">
            {rows.filter((a: any) => a.status === 'pre_approved_flexi').length} pre-approved · {rows.filter((a: any) => a.status === 'validated_flexi').length} validated
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="divide-y divide-teal-900/40 border-t border-teal-900/60">
          {rows.map((a: any) => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
              <div className="min-w-[160px]">
                <div className="text-sm font-medium text-foreground truncate">{a.full_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || '—'}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{a.phone || '—'}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_STYLES[a.status] || ''}`}>
                {ADMIN_STATUS_LABELS[a.status] || a.status}
              </span>
              <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                since {fmtDate((a as any).status_updated_at || a.updated_at)}
              </span>
              {a.fni_owner?.full_name && (
                <span className="text-[11px] text-zinc-500 whitespace-nowrap">F&I: {a.fni_owner.full_name}</span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                {a.status === 'pre_approved_flexi' && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 border-lime-500/40 text-lime-400 hover:bg-lime-500/10" disabled={busyId === a.id} onClick={() => markValidated(a)} title="Move to Validated Flexi">
                    <BadgeCheck className="w-3.5 h-3.5" /> Validated
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/admin/finance/${a.id}`)} title="Open full application">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
