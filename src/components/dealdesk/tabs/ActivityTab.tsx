import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Deal } from '@/lib/dealdesk/types';
import { formatDateTime } from '@/lib/dealdesk/format';
import { useDealEvents } from '@/hooks/dealdesk/useDealDesk';

export function ActivityTab({ deal }: { deal: Deal }) {
  const { data: events = [], isLoading } = useDealEvents(deal.id);
  const [actors, setActors] = useState<Record<string, string>>({});

  // Resolve actor ids -> display name (best-effort; blank if profiles unreadable).
  useEffect(() => {
    const ids = Array.from(new Set(events.map((e) => e.actor_id).filter(Boolean))) as string[];
    if (!ids.length) return;
    (async () => {
      try {
        const { data } = await (supabase as any).from('profiles').select('user_id, full_name, email').in('user_id', ids);
        const map: Record<string, string> = {};
        (data || []).forEach((p: any) => { map[p.user_id] = p.full_name || p.email || ''; });
        setActors(map);
      } catch (e) {
        console.error('[dealdesk] ActivityTab actor resolution failed (non-fatal):', e);
      }
    })();
  }, [events]);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  if (events.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>;

  return (
    <ul className="space-y-2.5">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm">{e.summary}</div>
            <div className="text-[11px] text-muted-foreground">
              {formatDateTime(e.created_at)}{e.actor_id && actors[e.actor_id] ? ` · ${actors[e.actor_id]}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
