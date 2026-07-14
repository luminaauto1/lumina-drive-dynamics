// DocsChasePanel — the pre-approval follow-up workstation (owner ask 2026-07-14):
// "This morning I had to call all our pre-approvals for documents and type each
// number into WhatsApp myself — there's no view showing contacted / documents
// received / anything."
//
// Lists every ACTIVE application sitting in pre_approved / pre_approved_flexi,
// least-recently-contacted first, with one-click actions per client:
//   • Called ✓ — stamps contacted (who + when); the actual contact happens
//     however the operator chooses (owner removed the wa.me button 2026-07-15).
//   • Docs in — moves the application to Docs Received via the normal status flow.
// A "contacted" stamp expires after 20 hours (same rule the status modal already
// uses), so yesterday's tick never hides today's chase.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, FileCheck2, ChevronDown, ChevronUp, ExternalLink, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateFinanceApplication, type FinanceApplication } from '@/hooks/useFinanceApplications';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CONTACT_TTL_MS } from '@/lib/finance/shared';

const CHASE_STATUSES = new Set(['pre_approved', 'pre_approved_flexi']);

const relTime = (iso?: string | null) => {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export function DocsChasePanel({ applications }: { applications: FinanceApplication[] }) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const updateApplication = useUpdateFinanceApplication();
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = applications.filter((a: any) =>
      CHASE_STATUSES.has(a.status) && a.is_archived !== true && a.phone,
    );
    // Never-contacted / stale first, then oldest contact first.
    const staleness = (a: any) => {
      const at = a.docs_contacted_at ? new Date(a.docs_contacted_at).getTime() : 0;
      const fresh = a.docs_contacted && at && Date.now() - at < CONTACT_TTL_MS;
      return fresh ? at : -1; // -1 sorts to the top
    };
    return [...list].sort((a: any, b: any) => staleness(a) - staleness(b));
  }, [applications]);

  const needsContact = rows.filter((a: any) => {
    const at = a.docs_contacted_at ? new Date(a.docs_contacted_at).getTime() : 0;
    return !(a.docs_contacted && at && Date.now() - at < CONTACT_TTL_MS);
  }).length;

  if (!(role === 'f_and_i' || role === 'senior_f_and_i' || role === 'super_admin')) return null;
  if (rows.length === 0) return null;

  const actorName = user?.email?.split('@')[0] || 'staff';

  const stampContacted = async (app: any, _via: 'call' = 'call') => {
    try {
      await supabase.from('finance_applications').update({
        docs_contacted: true,
        docs_contacted_at: new Date().toISOString(),
        docs_contacted_by: actorName,
      } as any).eq('id', app.id);
      await supabase.from('client_audit_logs').insert([{
        client_email: app.email || null,
        client_phone: app.phone || null,
        note: `Docs chase — contacted by ${actorName}`,
        author_id: user?.id || null,
        author_name: actorName,
        action_type: 'Docs Chase Contact',
        application_id: app.id,
      } as any]);
      // Realtime on finance_applications refreshes the list automatically.
    } catch (e) {
      console.error('[docs-chase] stamp failed', e);
    }
  };

  const docsIn = async (app: any) => {
    setBusyId(app.id);
    try {
      await updateApplication.mutateAsync({ id: app.id, updates: { status: 'documents_received' } });
      toast({ title: 'Moved to Docs Received', description: app.full_name || app.phone });
    } catch { /* hook toasts */ }
    finally { setBusyId(null); }
  };

  return (
    <div className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-lg mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-teal-400" />
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
            Docs Chase — Pre-Approvals
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${needsContact > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
            {needsContact > 0 ? `${needsContact} need contact` : 'all contacted'}
          </span>
          <span className="text-[11px] text-zinc-500">{rows.length} waiting for docs</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="divide-y divide-zinc-800/70 border-t border-zinc-800">
          {rows.map((a: any) => {
            const at = a.docs_contacted_at ? new Date(a.docs_contacted_at).getTime() : 0;
            const fresh = a.docs_contacted && at && Date.now() - at < CONTACT_TTL_MS;
            const flexi = a.status === 'pre_approved_flexi';
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                <div className="min-w-[160px]">
                  <div className="text-sm font-medium text-foreground truncate">{a.full_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || '—'}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{a.phone}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${flexi ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                  {flexi ? 'Flexi' : 'Pre-Approved'}
                </span>
                <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                  since {relTime((a as any).status_updated_at || a.updated_at) || '—'}
                </span>
                <span className={`text-[11px] whitespace-nowrap ${fresh ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {fresh
                    ? `✓ contacted ${relTime(a.docs_contacted_at)}${a.docs_contacted_by ? ` by ${a.docs_contacted_by}` : ''}`
                    : a.docs_contacted_at
                      ? `⚠ last contact ${relTime(a.docs_contacted_at)} — chase again`
                      : '⚠ never contacted'}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { void stampContacted(a, 'call'); toast({ title: 'Marked as contacted' }); }} title="Mark contacted (call / WhatsApp — however you reached them)">
                    <PhoneCall className="w-3.5 h-3.5" /> Contacted
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10" disabled={busyId === a.id} onClick={() => docsIn(a)} title="Documents received — move to Docs Received">
                    <FileCheck2 className="w-3.5 h-3.5" /> Docs in
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/admin/finance/${a.id}`)} title="Open full application">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
