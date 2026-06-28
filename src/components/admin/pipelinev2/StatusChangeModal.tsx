import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import type { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { useUpdateClientStatus } from '@/hooks/useFinanceApplications';
import { StatusSelect } from '@/components/admin/StatusSelect';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useAuth } from '@/contexts/AuthContext';
import { addPipelineNote } from '@/lib/pipelinev2/notes';

// Terminal statuses also archive (mirrors AdminFinance line ~1090 — 'lost' is a
// defensive extra that's never a STATUS_OPTIONS value; kept for parity).
const TERMINAL = ['declined', 'blacklisted', 'lost'];

const authorName = (user: any): string =>
  user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown';

export function StatusChangeModal({
  app, updateApplication, onClose, role,
}: {
  app: FinanceApplication;
  updateApplication: ReturnType<typeof useUpdateFinanceApplication>;
  onClose: () => void;
  /** Staff role — finance status options are filtered to what this role may set. */
  role?: string | null;
}) {
  const [status, setStatus] = useState<string>((app as any).status || 'pending');
  const [clientStatus, setClientStatus] = useState<string>((app as any).client_status || '');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { labels: financeLabels, clientStatuses, clientLabels, commentRequiredFor, commentPromptFor } = useStatusConfig();
  const updateClientStatus = useUpdateClientStatus();
  const { user } = useAuth();

  const financeChanged = status !== (app as any).status;
  const clientChanged = clientStatus !== ((app as any).client_status || '');
  // Comment is required if either the (changed) finance OR client status demands it.
  const gateStatus = financeChanged && commentRequiredFor(status)
    ? status
    : clientChanged && commentRequiredFor(clientStatus)
      ? clientStatus
      : '';
  const commentRequired = !!gateStatus;
  const commentMissing = commentRequired && !comment.trim();

  const submit = async () => {
    setError('');
    if (!financeChanged && !clientChanged) { onClose(); return; }
    if (commentMissing) { setError('A comment is required for this status.'); return; }
    setBusy(true);
    try {
      // Finance write — EXACT reuse of AdminFinance's mutation path (notify-*/
      // easysocial/auto-mailer + status_history all fire identically).
      if (financeChanged) {
        const updates: any = { status };
        if (TERMINAL.includes(status)) updates.is_archived = true;
        if (status === 'sent_to_banks') updates.internal_status = 'no_notes';
        await updateApplication.mutateAsync({ id: app.id, updates });
      }
      // Client status — isolated writer, no fan-out.
      if (clientChanged) {
        await updateClientStatus.mutateAsync({ id: app.id, client_status: clientStatus });
      }
      // Persist the gated comment as a status_change note.
      if (comment.trim()) {
        await addPipelineNote(app, {
          body: comment.trim(),
          category: 'status_change',
          author_id: user?.id ?? null,
          author_name: authorName(user),
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change status</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            {(app as any).full_name || [(app as any).first_name, (app as any).last_name].filter(Boolean).join(' ') || 'Applicant'}
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Finance status</Label>
            <StatusSelect
              track="finance"
              value={status}
              onChange={setStatus}
              role={role}
              labelOverrides={financeLabels}
            />
          </div>

          {clientStatuses.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client status</Label>
              <StatusSelect
                track="client"
                value={clientStatus}
                onChange={setClientStatus}
                options={clientStatuses}
                labelOverrides={clientLabels}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {commentRequired ? (commentPromptFor(gateStatus) || 'Comment') : 'Comment (optional)'}
              {commentRequired && <span className="text-red-400"> *</span>}
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder={commentRequired ? 'A comment is required for this status…' : 'Optional comment…'}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <p className="text-[11px] text-muted-foreground">
            Finance changes send the same WhatsApp / email / CRM notifications as the Finance page. Client-status changes are silent.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || (!financeChanged && !clientChanged) || commentMissing}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
