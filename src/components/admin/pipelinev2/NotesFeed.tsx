import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { useUpdateClientStatus } from '@/hooks/useFinanceApplications';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatTime } from '@/lib/pipelinev2/format';
import {
  noteCategory, readPipelineNotes, readLegacyNotes, addPipelineNote, type PipelineNote,
} from '@/lib/pipelinev2/notes';

const authorName = (user: any): string =>
  user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown';

function NoteCard({ note }: { note: PipelineNote }) {
  const cat = noteCategory(note.category);
  const when = note.legacyStamp
    ? note.legacyStamp
    : [formatDate(note.created_at), formatTime(note.created_at)].filter(Boolean).join(', ');
  const who = note.author_name || (note.legacyStamp ? 'Legacy note' : 'Unknown');
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      {note.category !== 'note' && (
        <span className={'mb-1.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' + cat.color}>
          {cat.label}{cat.emoji ? ` ${cat.emoji}` : ''}
        </span>
      )}
      <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{who}</span>
        {when ? ` · ${when}` : ''}
      </p>
    </div>
  );
}

// Notes write to finance_applications.pipeline_notes (structured, with author +
// timestamp). The legacy free-text `notes` column is shown read-only below so
// nothing is ever lost. Plain notes are a LEAD-DATA write only; the composer's
// select can ALSO set the real client status (fix/client-status-note-trap: the
// old note-category picker duplicated the client-status vocabulary, so staff
// picked "Actioned" here believing it set the status — it only tagged a note).
export function NotesFeed({ app }: { app: FinanceApplication }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState('');
  // 'note' = plain note only; any other value is a CONFIGURED client-status slug
  // applied via the same isolated writer the Change-status modal uses.
  const [clientStatus, setClientStatus] = useState('note');
  const [busy, setBusy] = useState(false);
  const { clientStatuses, clientLabels } = useStatusConfig();
  const updateClientStatus = useUpdateClientStatus();

  const notes = readPipelineNotes(app);
  const legacy = useMemo(() => readLegacyNotes(app), [app]);

  const settingStatus = clientStatus !== 'note';

  const add = async () => {
    const body = text.trim();
    if (!body && !settingStatus) return;
    setBusy(true);
    try {
      if (settingStatus) {
        // Same path as StatusChangeModal's client track — updates the Client
        // Status column and fires the hook's built-in auto-note (label rides
        // along so that note matches the badge verbatim). The hook toasts and
        // invalidates on its own.
        await updateClientStatus.mutateAsync({
          id: app.id,
          client_status: clientStatus,
          label: clientLabels[clientStatus] || undefined,
        });
        // Status applied — reset now so a retry of a failed note below can't
        // re-apply it (and re-stamp the auto-note).
        setClientStatus('note');
      }
      if (body) {
        // After a status write the hook just prepended its auto-note; re-read
        // fresh pipeline_notes so this prepend doesn't clobber it (mirrors
        // StatusChangeModal's comment write).
        const noteTarget = settingStatus
          ? (await supabase.from('finance_applications').select('id, pipeline_notes').eq('id', app.id).maybeSingle()).data ?? app
          : app;
        const { error } = await addPipelineNote(noteTarget as any, {
          body,
          category: 'note',
          author_id: user?.id ?? null,
          author_name: authorName(user),
        });
        if (error) { toast.error('Could not save note: ' + error); return; }
        if (!settingStatus) toast.success('Note added');
        qc.invalidateQueries({ queryKey: ['finance-applications'] });
      }
      setText('');
    } catch {
      // updateClientStatus surfaces its own error toast via the hook's onError.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="rounded-lg border border-border bg-card p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={settingStatus ? 'Optional note…' : 'Add a note (no status change)…'}
          className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Also set client status</span>
            <Select value={clientStatus} onValueChange={setClientStatus}>
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Also set client status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="note" className="text-xs">Note only</SelectItem>
                {clientStatuses.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {settingStatus ? 'Sets the Client Status column.' : 'Logged to the notes history.'}
            </span>
          </div>
          <Button size="sm" onClick={add} disabled={busy || (!text.trim() && !settingStatus)} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {settingStatus ? (text.trim() ? 'Set status + note' : 'Set status') : 'Add note'}
          </Button>
        </div>
      </div>

      {/* Feed */}
      {notes.length === 0 && legacy.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => <NoteCard key={n.id} note={n} />)}
          {legacy.length > 0 && (
            <>
              {notes.length > 0 && (
                <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Earlier notes
                </div>
              )}
              {legacy.map((n) => <NoteCard key={n.id} note={n} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
