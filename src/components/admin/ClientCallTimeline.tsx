import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Clock } from 'lucide-react';
import LiveCallCopilot from './LiveCallCopilot';

interface AuditEntry {
  id: string;
  note: string;
  author_name: string | null;
  action_type: string | null;
  created_at: string;
}

interface Props {
  clientEmail: string;
  clientPhone: string;
  clientName: string;
}

export default function ClientCallTimeline({ clientEmail, clientPhone, clientName }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    setLoading(true);
    let query = supabase.from('client_audit_logs').select('*').order('created_at', { ascending: false }).limit(40);
    if (clientEmail) {
      query = query.eq('client_email', clientEmail);
    } else if (clientPhone) {
      query = query.eq('client_phone', clientPhone);
    }
    const { data } = await query;
    setEntries((data as AuditEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [clientEmail, clientPhone]);

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Sparkles className="w-4 h-4 text-primary" />
          Voice AI & Call Timeline
        </h3>
      </div>

      <LiveCallCopilot
        clientEmail={clientEmail}
        clientPhone={clientPhone}
        clientName={clientName}
        onCallEnd={fetchEntries}
      />

      <div className="border-t border-border pt-4 space-y-3 max-h-[480px] overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading timeline…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No notes yet. Recorded calls will appear here.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="relative pl-4 border-l border-zinc-700/60">
              <div className="absolute -left-1.5 top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                <Clock className="w-3 h-3" />
                {new Date(e.created_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                <span>·</span>
                <span>{e.author_name || 'Admin'}</span>
                {e.action_type && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] uppercase tracking-wider">{e.action_type}</span>}
              </div>
              <pre className="text-xs text-foreground/85 whitespace-pre-wrap font-sans leading-relaxed">{e.note}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
