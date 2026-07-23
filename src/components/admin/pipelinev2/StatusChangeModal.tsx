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
import { usePipelineLanes } from '@/hooks/usePipelineLanes';
import { useAuth } from '@/contexts/AuthContext';
import { addPipelineNote } from '@/lib/pipelinev2/notes';
import { supabase } from '@/integrations/supabase/client';

// Terminal statuses also archive (mirrors AdminFinance line ~1090 — 'lost' is a
// defensive extra that's never a STATUS_OPTIONS value; kept for parity).
const TERMINAL = ['declined', 'blacklisted', 'lost'];

const authorName = (user: any): string =>
  user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown';

export function StatusChangeModal({
  app, updateApplication, onClose, role, initialTrack = 'finance',
}: {
  app: FinanceApplication;
  updateApplication: ReturnType<typeof useUpdateFinanceApplication>;
  onClose: () => void;
  /** Staff role — finance status options are filtered to what this role may set. */
  role?: string | null;
  /** Which track the modal opens on (default 'finance'). The Client Status badge
   *  passes 'client' so the Client tab is pre-selected. */
  initialTrack?: 'finance' | 'client';
}) {
  const [status, setStatus] = useState<string>((app as any).status || 'pending');
  const [clientStatus, setClientStatus] = useState<string>((app as any).client_status || '');
  const [track, setTrack] = useState<'finance' | 'client'>(initialTrack);
  const [comment, setComment] = useState('');
  const [waClientInfo, setWaClientInfo] = useState('');
  const [fniNote, setFniNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const {
    labels: financeLabels, clientStatuses, clientLabels, commentRequiredFor, commentPromptFor,
    waClientInfoEnabledFor, waClientInfoRequiredFor, waClientInfoPromptFor,
    fniNoteEnabledFor, fniNoteRequiredFor, fniNotePromptFor,
    clientLaneOverrides,
  } = useStatusConfig();
  // Effective lane labels (Settings → Pipeline Lanes renames included), so the
  // hint below names the lane the way the tab bar does.
  const lanes = usePipelineLanes();
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

  // WhatsApp To Client Info gate — independent of the comment gate. A SINGLE box
  // can be wanted by the finance status AND/OR the client status being changed in
  // this submit, so evaluate each independently: show it if EITHER enables it,
  // require it if EITHER requires it, and (on submit) feed the text to EVERY send
  // that wants it. This avoids a required client-status gate being bypassed when a
  // non-required finance status changes alongside it.
  const financeWantsInfo = financeChanged && waClientInfoEnabledFor(status);
  const clientWantsInfo = clientChanged && waClientInfoEnabledFor(clientStatus);
  const waInfoEnabled = financeWantsInfo || clientWantsInfo;
  const waInfoRequired =
    (financeWantsInfo && waClientInfoRequiredFor(status)) ||
    (clientWantsInfo && waClientInfoRequiredFor(clientStatus));
  const waInfoMissing = waInfoRequired && !waClientInfo.trim();
  // Prompt label: prefer the finance status's prompt, else the client status's.
  const waInfoStatus = financeWantsInfo ? status : clientWantsInfo ? clientStatus : '';

  // F&I notes gate — independent of the comment + WhatsApp gates, same dual-track
  // logic: show the box if EITHER the changed finance or client status enables it,
  // require it if EITHER requires it.
  const financeWantsFni = financeChanged && fniNoteEnabledFor(status);
  const clientWantsFni = clientChanged && fniNoteEnabledFor(clientStatus);
  const fniEnabled = financeWantsFni || clientWantsFni;
  const fniRequired =
    (financeWantsFni && fniNoteRequiredFor(status)) ||
    (clientWantsFni && fniNoteRequiredFor(clientStatus));
  const fniMissing = fniRequired && !fniNote.trim();
  const fniStatus = financeWantsFni ? status : clientWantsFni ? clientStatus : '';

  // A client status may carry its own destination lane (status_overrides.lane),
  // which OUTRANKS the finance lane — so the track hint can't claim client
  // statuses never move tabs. Resolved for the status currently picked below.
  const clientLaneKey = clientStatus ? clientLaneOverrides[clientStatus] : undefined;
  const clientLaneLabel = clientLaneKey
    ? lanes.find((l) => l.key === clientLaneKey)?.label
    : undefined;

  const submit = async () => {
    setError('');
    // Allow a comment-only update (log a note without changing a status), so the
    // button isn't permanently greyed out when the shown status is already current.
    if (!financeChanged && !clientChanged && !comment.trim() && !waClientInfo.trim() && !fniNote.trim()) { onClose(); return; }
    if (commentMissing) { setError('A comment is required for this status.'); return; }
    if (waInfoMissing) { setError('A WhatsApp To Client Info message is required for this status.'); return; }
    if (fniMissing) { setError('An F&I note is required for this status.'); return; }
    setBusy(true);
    try {
      // Finance write — EXACT reuse of AdminFinance's mutation path (notify-*/
      // easysocial/auto-mailer + status_history all fire identically).
      if (financeChanged) {
        const updates: any = { status };
        if (TERMINAL.includes(status)) updates.is_archived = true;
        if (status === 'sent_to_banks') updates.internal_status = 'no_notes';
        // Feed the WhatsApp To Client Info text to the finance wa-status-send when
        // the finance status enables the box. Stripped before the DB write in the
        // hook. (The client route below is fed independently.)
        if (financeWantsInfo && waClientInfo.trim()) updates.wa_client_info = waClientInfo.trim();
        await updateApplication.mutateAsync({ id: app.id, updates });
      }
      // Client status — isolated writer. The exact label rides along so the
      // auto-note ("No Answer", …) matches the badge verbatim, and the box text
      // routes here (and to the client status's own opt-in wa-status-send) when
      // the box owner is the client status; otherwise the finance path owns it.
      if (clientChanged) {
        await updateClientStatus.mutateAsync({
          id: app.id,
          client_status: clientStatus,
          label: clientLabels[clientStatus] || undefined,
          wa_client_info: clientWantsInfo && waClientInfo.trim() ? waClientInfo.trim() : undefined,
        });
      }
      // Persist the gated comment as a status_change note.
      if (comment.trim()) {
        await addPipelineNote(app, {
          body: comment.trim(),
          category: financeChanged || clientChanged ? 'status_change' : 'note',
          author_id: user?.id ?? null,
          author_name: authorName(user),
        });
      }
      // Persist the WhatsApp To Client Info text as its own note (always logged).
      // Re-fetch fresh pipeline_notes so this prepend doesn't clobber the comment
      // note written just above (addPipelineNote reads notes off the passed row).
      if (waClientInfo.trim()) {
        const noteTarget = comment.trim()
          ? (await supabase.from('finance_applications').select('id, pipeline_notes').eq('id', app.id).maybeSingle()).data ?? app
          : app;
        await addPipelineNote(noteTarget as any, {
          body: waClientInfo.trim(),
          category: 'client_whatsapp',
          author_id: user?.id ?? null,
          author_name: authorName(user),
        });
      }
      // Persist the F&I note as its own (user-facing) note. addPipelineNote re-reads
      // the DB notes before writing, so it never clobbers the notes written above.
      if (fniNote.trim()) {
        await addPipelineNote(app, {
          body: fniNote.trim(),
          category: 'fni_note',
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
          {/* ZTC-style track toggle — always visible, switches the editor below. */}
          <div className="space-y-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setTrack('finance')}
                className={'px-3 py-1.5 text-xs font-medium transition ' +
                  (track === 'finance' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                Finance Application Status
              </button>
              <button
                type="button"
                onClick={() => setTrack('client')}
                className={'px-3 py-1.5 text-xs font-medium transition border-l border-border ' +
                  (track === 'client' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                Current Client Status
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {track === 'finance'
                ? 'Main pipeline status — moves the row to the matching tab and sends notifications.'
                : clientLaneLabel
                  ? `Working status — this one moves the row to ${clientLaneLabel}, overriding the finance status's tab.`
                  : 'Working status — leaves the row in the tab its finance status puts it in.'}
            </p>
          </div>

          {track === 'finance' ? (
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
          ) : clientStatuses.length > 0 ? (
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
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              No client statuses defined yet. Add them in{' '}
              <span className="font-medium text-foreground">Settings → Statuses</span>{' '}
              (use the Finance/Client toggle in the status editor), and they'll appear here.
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

          {/* WhatsApp To Client Info — shown only when the changed status enables it. */}
          {waInfoEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                WhatsApp To Client Info
                {waInfoRequired && <span className="text-red-400"> *</span>}
              </Label>
              <Textarea
                value={waClientInfo}
                onChange={(e) => setWaClientInfo(e.target.value)}
                rows={2}
                placeholder={waClientInfoPromptFor(waInfoStatus) || (waInfoRequired ? 'A WhatsApp message is required for this status…' : 'Message to send the client on WhatsApp…')}
              />
            </div>
          )}

          {/* F&I notes — shown only when the changed status enables it. Internal;
              saved as a normal note, never sent to the client. */}
          {fniEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {fniNotePromptFor(fniStatus) || 'F&I notes'}
                {fniRequired && <span className="text-red-400"> *</span>}
              </Label>
              <Textarea
                value={fniNote}
                onChange={(e) => setFniNote(e.target.value)}
                rows={2}
                placeholder={fniRequired ? 'An F&I note is required for this status…' : 'Internal F&I note (e.g. deposit needed)…'}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          <p className="text-[11px] text-muted-foreground">
            Finance changes send the same WhatsApp / email / CRM notifications as the Finance page. Client-status changes are silent.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || (!financeChanged && !clientChanged && !comment.trim() && !waClientInfo.trim() && !fniNote.trim()) || commentMissing || waInfoMissing || fniMissing}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
