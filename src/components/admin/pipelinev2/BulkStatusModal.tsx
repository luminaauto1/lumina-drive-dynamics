import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { StatusSelect } from '@/components/admin/StatusSelect';
import type { StatusTrack } from '@/lib/admin/statusTracks';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addPipelineNote } from '@/lib/pipelinev2/notes';

const TERMINAL = ['declined', 'blacklisted', 'lost'];

const authorName = (user: any): string =>
  user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown';

export function BulkStatusModal({
  appIds, updateApplication, onClose, onDone, role, labelOverrides, onApplyDealStage,
}: {
  appIds: string[];
  updateApplication: ReturnType<typeof useUpdateFinanceApplication>;
  onClose: () => void;
  onDone: () => void;
  /** Staff role — finance options are filtered to what this role may set. */
  role?: string | null;
  /** Effective finance label overrides (useStatusConfig().labels). */
  labelOverrides?: Record<string, string>;
  /** When provided, a second "Deal stage" track is offered; receives the chosen
   *  deal-stage value to apply across `appIds`. Absent => finance track only. */
  onApplyDealStage?: (stage: string, appIds: string[]) => Promise<{ failed: string[] }>;
}) {
  const [track, setTrack] = useState<StatusTrack>('finance');
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const [waClientInfo, setWaClientInfo] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  const {
    commentRequiredFor, commentPromptFor,
    waClientInfoEnabledFor, waClientInfoRequiredFor, waClientInfoPromptFor,
  } = useStatusConfig();
  const { user } = useAuth();

  // Comment gate only applies to the finance track here (deal stage has no rules).
  const commentRequired = track === 'finance' && !!status && commentRequiredFor(status);
  const commentMissing = commentRequired && !comment.trim();

  // WhatsApp To Client Info — a single message applied to every selected row.
  // Finance track only (deal stage has no rules). Same enable/require semantics.
  const waInfoEnabled = track === 'finance' && !!status && waClientInfoEnabledFor(status);
  const waInfoRequired = waInfoEnabled && waClientInfoRequiredFor(status);
  const waInfoMissing = waInfoRequired && !waClientInfo.trim();

  const run = async () => {
    if (!status) return;
    if (commentMissing) return;
    if (waInfoMissing) return;
    setRunning(true); setDone(0); setFailures([]);

    // Deal-stage track: delegate the whole batch to the caller's updater (writes
    // to deal_records, not finance_applications). Progress is coarse here.
    if (track === 'deal' && onApplyDealStage) {
      try {
        const { failed } = await onApplyDealStage(status, appIds);
        setDone(appIds.length);
        setFailures(failed);
        setRunning(false);
        if (failed.length === 0) { onDone(); onClose(); }
      } catch {
        setFailures(appIds);
        setRunning(false);
      }
      return;
    }

    const fails: string[] = [];
    const noteBody = comment.trim();
    const waInfoBody = waInfoEnabled ? waClientInfo.trim() : '';
    // Sequential — each row goes through the SAME mutation so every notification
    // fires (matches ZTC's per-row change-status loop). The hook toasts per row.
    for (const id of appIds) {
      try {
        const updates: any = { status };
        if (TERMINAL.includes(status)) updates.is_archived = true;
        if (status === 'sent_to_banks') updates.internal_status = 'no_notes';
        // Feed the shared WhatsApp To Client Info text to wa-status-send (finance
        // fan-out). Stripped before the DB write in the hook.
        if (waInfoBody) updates.wa_client_info = waInfoBody;
        await updateApplication.mutateAsync({ id, updates });
        // Persist the batch comment + WhatsApp message per row as notes. addPipelineNote
        // reads pipeline_notes off the passed row, so re-fetch fresh before EACH write
        // (otherwise the second note's update would clobber the first).
        if (noteBody || waInfoBody) {
          const fetchRow = async () => {
            const { data } = await supabase
              .from('finance_applications')
              .select('id, pipeline_notes')
              .eq('id', id)
              .maybeSingle();
            return (data ?? { id }) as any;
          };
          if (noteBody) {
            await addPipelineNote(await fetchRow(), {
              body: noteBody,
              category: 'status_change',
              author_id: user?.id ?? null,
              author_name: authorName(user),
            });
          }
          if (waInfoBody) {
            await addPipelineNote(await fetchRow(), {
              body: waInfoBody,
              category: 'client_whatsapp',
              author_id: user?.id ?? null,
              author_name: authorName(user),
            });
          }
        }
      } catch {
        fails.push(id);
      }
      setDone((d) => d + 1);
    }
    setFailures(fails);
    setRunning(false);
    if (fails.length === 0) { onDone(); onClose(); }
  };

  const setTrackAndReset = (t: StatusTrack) => { setTrack(t); setStatus(''); setComment(''); setWaClientInfo(''); };

  return (
    <Dialog open onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change status for {appIds.length} application{appIds.length === 1 ? '' : 's'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          {/* Track toggle — only when a deal-stage updater is supplied. */}
          {onApplyDealStage && (
            <div className="inline-flex h-9 items-center rounded-md border border-border bg-background p-0.5 text-xs">
              {([['finance', 'Finance status'], ['deal', 'Deal stage']] as const).map(([val, label]) => (
                <button key={val} type="button" disabled={running} onClick={() => setTrackAndReset(val)}
                  className={'rounded px-2.5 py-1 font-medium transition ' +
                    (track === val ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <StatusSelect
            track={track}
            value={status}
            onChange={setStatus}
            role={track === 'finance' ? role : undefined}
            labelOverrides={labelOverrides}
            disabled={running}
            className="w-full"
          />

          {/* Comment gate — shown for the finance track when the chosen status requires it. */}
          {commentRequired && !running && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {commentPromptFor(status) || 'Comment'}<span className="text-red-400"> *</span>
              </Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="A comment is required for this status — applied to every selected application."
              />
            </div>
          )}

          {/* WhatsApp To Client Info — one message applied to every selected row. */}
          {waInfoEnabled && !running && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                WhatsApp To Client Info{waInfoRequired && <span className="text-red-400"> *</span>}
              </Label>
              <Textarea
                value={waClientInfo}
                onChange={(e) => setWaClientInfo(e.target.value)}
                rows={2}
                placeholder={waClientInfoPromptFor(status) || 'Message to send the client on WhatsApp — applied to every selected application.'}
              />
            </div>
          )}

          {running && <p className="text-sm text-muted-foreground">Processing {done}/{appIds.length}…{track === 'finance' ? ' (each fires its own notifications)' : ''}</p>}
          {failures.length > 0 && <p className="text-sm text-red-400">{failures.length} failed — others applied. Close and retry the rest.</p>}
          {!running && track === 'finance' && <p className="text-[11px] text-muted-foreground">Each application is updated individually so its WhatsApp / email / CRM notification fires — expect one toast per application.</p>}
          {!running && track === 'deal' && <p className="text-[11px] text-muted-foreground">Sets the back-office deal stage on each linked deal. No client notifications fire for deal-stage changes.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>Cancel</Button>
          <Button onClick={run} disabled={running || !status || commentMissing || waInfoMissing}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Apply to {appIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
