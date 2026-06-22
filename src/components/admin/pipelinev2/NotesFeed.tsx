import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatDate, formatTime } from '@/lib/pipelinev2/format';

// Notes reuse the existing finance_applications.notes text field (parity with
// AdminFinance). The composer is a LEAD-DATA write only — NOT a status change —
// so it triggers none of the notify-*/easysocial side-effects.
export function NotesFeed({ app }: { app: FinanceApplication }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const notes = (app as any).notes as string | null;
  const entries = (notes || '').split(/\n\n+/).map((s) => s.trim()).filter(Boolean);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const stamp = `[${formatDate(new Date().toISOString())} ${formatTime(new Date().toISOString())}]`;
    const merged = `${stamp} ${body}${notes ? `\n\n${notes}` : ''}`;
    const { error } = await supabase.from('finance_applications').update({ notes: merged } as any).eq('id', app.id);
    setBusy(false);
    if (error) { toast.error('Could not save note: ' + error.message); return; }
    setText('');
    toast.success('Note added');
    qc.invalidateQueries({ queryKey: ['finance-applications'] });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a team note…" className="text-sm" />
        <Button type="button" size="icon" onClick={add} disabled={busy || !text.trim()} aria-label="Add note">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => (
            <li key={i} className="rounded-md border border-border bg-muted/20 p-2.5 text-sm whitespace-pre-wrap">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
