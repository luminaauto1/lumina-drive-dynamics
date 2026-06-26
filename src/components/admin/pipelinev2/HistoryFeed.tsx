import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft, StickyNote, FilePlus, Circle,
  CreditCard, FileSignature, Upload, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { ADMIN_STATUS_LABELS } from '@/lib/statusConfig';
import { formatDate, formatTime, relativeTime } from '@/lib/pipelinev2/format';
import { readPipelineNotes, noteCategory } from '@/lib/pipelinev2/notes';

type HistoryKind = 'status' | 'note' | 'created' | 'credit' | 'contract' | 'upload' | 'deal' | 'system';

interface HistoryItem {
  id: string;
  kind: HistoryKind;
  title: string;
  detail?: string;
  author?: string;
  timestamp: string; // ISO
}

const ICONS: Record<HistoryKind, { icon: any; color: string }> = {
  status:   { icon: ArrowRightLeft, color: 'text-cyan-400' },
  note:     { icon: StickyNote,     color: 'text-blue-400' },
  created:  { icon: FilePlus,       color: 'text-muted-foreground' },
  credit:   { icon: CreditCard,     color: 'text-amber-400' },
  contract: { icon: FileSignature,  color: 'text-violet-400' },
  upload:   { icon: Upload,         color: 'text-sky-400' },
  deal:     { icon: CheckCircle2,   color: 'text-emerald-400' },
  system:   { icon: Circle,         color: 'text-muted-foreground' },
};

function auditKind(actionType: string): HistoryKind {
  switch (actionType) {
    case 'status_change': return 'status';
    case 'credit_check': return 'credit';
    case 'contract': return 'contract';
    case 'document_upload': return 'upload';
    case 'deal_finalized': return 'deal';
    case 'application_created': return 'created';
    case 'note': return 'note';
    default: return 'system';
  }
}

// Read-only "who did what, when" timeline for one application. Primary source is the
// universal activity trail (client_audit_logs by application_id) — each entry carries
// the acting person's name + time. Pipeline notes are merged in alongside. For legacy
// applications with no audit entries yet, we fall back to status_history (unattributed).
export function HistoryFeed({ app }: { app: FinanceApplication }) {
  const appId = (app as any).id as string;

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['app-audit-logs', appId],
    enabled: !!appId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('client_audit_logs')
        .select('id, note, action_type, author_name, created_at')
        .eq('application_id', appId)
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as Array<{
        id: string; note: string; action_type: string; author_name: string | null; created_at: string;
      }>;
    },
  });

  const items = useMemo<HistoryItem[]>(() => {
    const any = app as any;
    const out: HistoryItem[] = [];
    const hasAudit = auditLogs.length > 0;

    if (hasAudit) {
      auditLogs.forEach((a) => {
        if (!a.created_at) return;
        out.push({
          id: `audit-${a.id}`,
          kind: auditKind(a.action_type),
          title: a.note || a.action_type,
          author: a.author_name || undefined,
          timestamp: a.created_at,
        });
      });
    } else {
      // Legacy fallback — status changes recorded before the activity trail existed
      // (no person captured, shown as "System").
      const statusHistory = Array.isArray(any.status_history) ? any.status_history : [];
      statusHistory.forEach((e: any, i: number) => {
        if (!e?.timestamp) return;
        out.push({
          id: `status-${i}-${e.timestamp}`,
          kind: 'status',
          title: `Status changed to ${ADMIN_STATUS_LABELS[e.status] || e.status}`,
          author: 'System',
          timestamp: e.timestamp,
        });
      });
    }

    // Structured notes (kept in pipeline_notes — not mirrored to the audit log, so no dup).
    readPipelineNotes(app).forEach((n) => {
      if (!n.created_at) return;
      const cat = noteCategory(n.category);
      out.push({
        id: `note-${n.id}`,
        kind: 'note',
        title: n.category !== 'note' ? `Note added · ${cat.label}` : 'Note added',
        detail: n.body,
        author: n.author_name || undefined,
        timestamp: n.created_at,
      });
    });

    // "Application created" — only if not already represented by an audit entry.
    if (any.created_at && !auditLogs.some((a) => a.action_type === 'application_created')) {
      out.push({
        id: 'created',
        kind: 'created',
        title: 'Application created',
        timestamp: any.created_at,
      });
    }

    return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [app, auditLogs]);

  if (items.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No history yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const { icon: Icon, color } = ICONS[item.kind] || { icon: Circle, color: 'text-muted-foreground' };
        return (
          <li key={item.id} className="flex items-start gap-2.5">
            <Icon className={'mt-0.5 h-4 w-4 shrink-0 ' + color} />
            <div className="min-w-0 flex-1 border-b border-border/40 pb-3 last:border-0">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              {item.detail && (
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.detail}</p>
              )}
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {item.author ? <span className="text-foreground/70">{item.author}</span> : null}
                {item.author ? ' · ' : ''}
                {formatDate(item.timestamp)} {formatTime(item.timestamp)}
                <span className="opacity-60"> · {relativeTime(item.timestamp)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
