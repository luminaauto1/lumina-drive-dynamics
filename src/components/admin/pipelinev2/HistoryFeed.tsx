import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { ADMIN_STATUS_LABELS } from '@/lib/statusConfig';
import { formatDate, formatTime, relativeTime } from '@/lib/pipelinev2/format';

// Read-only timeline from finance_applications.status_history (the hook appends
// { status, timestamp } on every real status change). Lumina has no events table.
export function HistoryFeed({ app }: { app: FinanceApplication }) {
  const raw = (app as any).status_history;
  const entries: { status: string; timestamp: string }[] = Array.isArray(raw) ? raw : [];
  const ordered = [...entries].reverse();

  if (ordered.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No status history yet.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {ordered.map((e, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium">{ADMIN_STATUS_LABELS[e.status] || e.status}</div>
            <div className="text-[11px] text-muted-foreground">
              {formatDate(e.timestamp)} {formatTime(e.timestamp)} · {relativeTime(e.timestamp)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
