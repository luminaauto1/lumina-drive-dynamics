import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatDate, formatTime } from '@/lib/pipelinev2/format';
import {
  NOTE_CATEGORIES, noteCategory, readPipelineNotes, readLegacyNotes, addPipelineNote, type PipelineNote,
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
// nothing is ever lost. A note is a LEAD-DATA write only — never a status change.
export function NotesFeed({ app }: { app: FinanceApplication }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('note');
  const [busy, setBusy] = useState(false);

  const notes = readPipelineNotes(app);
  const legacy = useMemo(() => readLegacyNotes(app), [app]);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await addPipelineNote(app, {
      body,
      category,
      author_id: user?.id ?? null,
      author_name: authorName(user),
    });
    setBusy(false);
    if (error) { toast.error('Could not save note: ' + error); return; }
    setText('');
    setCategory('note');
    toast.success('Note added');
    qc.invalidateQueries({ queryKey: ['finance-applications'] });
  };

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="rounded-lg border border-border bg-card p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Add a note (no status change)…"
          className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTE_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key} className="text-xs">
                    {c.label}{c.emoji ? ` ${c.emoji}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Logged to the notes history.</span>
          </div>
          <Button size="sm" onClick={add} disabled={busy || !text.trim()} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add note
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
