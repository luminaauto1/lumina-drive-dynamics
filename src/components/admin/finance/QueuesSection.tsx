// "MY WORK" — the stage work-queues for the Finance page (redesign P2).
// Builds each declarative QueueDef's row set from the active applications,
// appends the cross-cutting ⚠ Stalled queue (every SLA breach, worst first),
// and routes every action through the page's standard interceptor chain.
import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FINANCE_QUEUES, type QueueAction, type QueueDef } from '@/lib/finance/queues';
import { ageInStatusMs, isStalled, slaOverrunMs } from '@/lib/finance/sla';
import { QueuePanel } from './QueuePanel';

const STALLED_QUEUE: QueueDef = {
  key: 'stalled',
  title: '⚠ Stalled — Over SLA',
  hint: 'Everything over its stage SLA, worst first',
  icon: 'stalled',
  accent: 'text-red-400',
  match: (a) => a?.is_archived !== true && isStalled(a),
  slaStatus: null,
  urgency: (a) => slaOverrunMs(a),
  actions: [],
};

export function QueuesSection({
  applications,
  role,
  onSetStatus,
}: {
  applications: any[];
  role: string | null | undefined;
  onSetStatus: (app: any, targetStatus: string) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Same audience as the old DocsChase/Flexi panels: the people who WORK files.
  const eligible = role === 'f_and_i' || role === 'senior_f_and_i' || role === 'super_admin';

  const queues = useMemo(() => {
    const defs = [...FINANCE_QUEUES, STALLED_QUEUE];
    return defs.map((def) => ({
      def,
      apps: applications
        .filter((a) => def.match(a))
        .sort((a, b) => (def.urgency ? def.urgency(b) - def.urgency(a) : ageInStatusMs(b) - ageInStatusMs(a))),
    }));
  }, [applications]);

  if (!eligible) return null;
  const totalWaiting = queues.reduce((n, q) => (q.def.key === 'stalled' ? n : n + q.apps.length), 0);
  const stalledCount = queues.find((q) => q.def.key === 'stalled')?.apps.length ?? 0;
  if (totalWaiting === 0 && stalledCount === 0) return null;

  // "Contacted" stamp (docs chase) — same write + audit the old panel did.
  const stampContacted = async (app: any) => {
    const actorName = user?.email?.split('@')[0] || 'staff';
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
      toast({ title: 'Marked as contacted' });
      // Realtime on finance_applications refreshes the list automatically.
    } catch (e) {
      console.error('[queues] contacted stamp failed', e);
      toast({ title: 'Failed to mark contacted', variant: 'destructive' });
    }
  };

  const handleAction = async (app: any, action: QueueAction) => {
    if (action.kind === 'contacted') {
      void stampContacted(app);
      return;
    }
    if (action.kind === 'set_status' && action.targetStatus) {
      setBusyId(app.id);
      try {
        // Standard interceptor chain (bank-ref modal → comment gate → hook):
        // identical side-effects to the inline dropdown for the same transition.
        onSetStatus(app, action.targetStatus);
      } finally {
        // The chain may continue in a modal; the realtime refresh re-renders us.
        setBusyId(null);
      }
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <ListChecks className="w-4 h-4 text-zinc-400" />
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">My Work</span>
        <span className="text-[11px] text-zinc-500">
          {totalWaiting} file{totalWaiting === 1 ? '' : 's'} waiting on an action
          {stalledCount > 0 && <span className="text-red-400"> · {stalledCount} over SLA</span>}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {queues.map(({ def, apps }) => (
          <QueuePanel
            key={def.key}
            def={def}
            apps={apps}
            busyId={busyId}
            onAction={handleAction}
            defaultOpen={def.key !== 'stalled'}
          />
        ))}
      </div>
    </div>
  );
}
