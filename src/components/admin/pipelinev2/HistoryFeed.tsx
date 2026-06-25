import { useMemo } from 'react';
import { ArrowRightLeft, StickyNote, FilePlus, Circle } from 'lucide-react';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { ADMIN_STATUS_LABELS } from '@/lib/statusConfig';
import { formatDate, formatTime, relativeTime } from '@/lib/pipelinev2/format';
import { readPipelineNotes, noteCategory } from '@/lib/pipelinev2/notes';

type HistoryKind = 'status' | 'note' | 'created';

interface HistoryItem {
  id: string;
  kind: HistoryKind;
  title: string;
  detail?: string;
  author?: string;
  timestamp: string; // ISO
}

const ICONS: Record<HistoryKind, { icon: any; color: string }> = {
  status:  { icon: ArrowRightLeft, color: 'text-cyan-400' },
  note:    { icon: StickyNote,     color: 'text-blue-400' },
  created: { icon: FilePlus,       color: 'text-muted-foreground' },
};

// Read-only "what changed on this lead" timeline. Merges:
//  • status changes  — finance_applications.status_history (status_updated_at)
//  • notes added      — finance_applications.pipeline_notes
//  • application created
// Newest first. Status changes are the canonical "profile change" event Lumina
// records; notes show as activity alongside them.
export function HistoryFeed({ app }: { app: FinanceApplication }) {
  const items = useMemo<HistoryItem[]>(() => {
    const any = app as any;
    const out: HistoryItem[] = [];

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

    if (any.created_at) {
      out.push({
        id: 'created',
        kind: 'created',
        title: 'Application created',
        timestamp: any.created_at,
      });
    }

    return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [app]);

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
