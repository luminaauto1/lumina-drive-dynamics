// Reply Suggester — the retired WhatsApp auto-responder's brain, offline.
//
// 2026-07-10: the EasySocial auto-responder was DISCONNECTED COMPLETELY (its
// automated sends kept getting the dealership's WhatsApp number banned).
// Nothing on this page talks to WhatsApp or EasySocial anymore — the only
// backend is the chat-suggest edge function, which reads the Lumina knowledge
// base and the answers the team has taught it.
//
// Flow: paste a client's question → the brain suggests the best answer (+ a
// few close alternates) → edit if needed → COPY it and send it yourself from
// wherever you like. "Teach" saves the Q→A pair so the brain knows it next time.
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bot, BookOpenCheck, Copy, GraduationCap, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Suggestion { text: string; source?: string; reason?: string | null; ref?: string | null; confidence?: number | null }
interface Alternate { text: string; ref: string; score: number }
interface LearnedItem {
  id: number; match_key: string; sample_inbound: string | null; message: string;
  hits: number; active: boolean; created_at: string;
}

const AdminChatControl = () => {
  const [question, setQuestion] = useState('');
  const [clientName, setClientName] = useState('');
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState('');            // editable working copy
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [alternates, setAlternates] = useState<Alternate[]>([]);
  const [holding, setHolding] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);           // a suggest round-trip happened
  const [teaching, setTeaching] = useState(false);
  const [learned, setLearned] = useState<LearnedItem[]>([]);

  const invoke = useCallback(async (fn: string, opts: any = {}) => {
    const { data, error } = await supabase.functions.invoke(fn, opts);
    if (error) throw new Error(error.message || `${fn} failed`);
    if (data && data.ok === false) throw new Error(data.error || `${fn} failed`);
    return data;
  }, []);

  const loadLearned = useCallback(async () => {
    try { const d = await invoke('chat-suggest?view=learned', { method: 'GET' }); setLearned(d.items || []); }
    catch { /* list is optional */ }
  }, [invoke]);

  useEffect(() => { loadLearned(); }, [loadLearned]);

  const suggest = async () => {
    const q = question.trim();
    if (!q) { toast.error('Paste the client’s question first'); return; }
    setThinking(true);
    setAsked(false);
    try {
      const d = await invoke('chat-suggest', { body: { question: q, name: clientName.trim() } });
      setSuggestion(d.suggestion || null);
      setAlternates(d.alternates || []);
      setHolding(d.holding_text || null);
      setAnswer(d.suggestion?.text || '');
      setAsked(true);
      if (!d.suggestion && !(d.alternates || []).length) {
        toast.info('The brain has no confident answer — write one below and hit Teach so it knows next time.');
      }
    } catch (e: any) { toast.error(`Suggest: ${e.message}`); }
    finally { setThinking(false); }
  };

  const copyAnswer = async (text: string) => {
    if (!text.trim()) { toast.error('Nothing to copy'); return; }
    try { await navigator.clipboard.writeText(text.trim()); toast.success('Copied — paste it wherever you’re chatting'); }
    catch { toast.error('Copy failed — select the text and copy manually'); }
  };

  const teach = async () => {
    const q = question.trim(); const a = answer.trim();
    if (!q || !a) { toast.error('Need both the question and the answer to teach'); return; }
    setTeaching(true);
    try {
      await invoke('chat-suggest', { body: { learn: { question: q, answer: a } } });
      toast.success('Learned ✓ — the brain will suggest this for the same (and similar) questions');
      loadLearned();
    } catch (e: any) { toast.error(`Teach: ${e.message}`); }
    finally { setTeaching(false); }
  };

  const toggleLearned = async (row: LearnedItem) => {
    try {
      await invoke('chat-suggest', { body: { toggleLearnedId: row.id, active: !row.active } });
      setLearned((p) => p.map((x) => (x.id === row.id ? { ...x, active: !row.active } : x)));
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" /> Reply Suggester
            <Badge variant="outline" className="ml-2 border-emerald-500/60 text-emerald-400">OFFLINE — SENDS NOTHING</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a client’s question and the brain suggests an answer from your knowledge base and everything you’ve
            taught it. It has <strong>no connection to WhatsApp or EasySocial</strong> — you copy the reply and send it yourself.
          </p>
        </div>

        {/* Ask */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Wand2 className="w-4 h-4" /> Client question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={3} placeholder="Paste what the client asked…"
              value={question} onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) suggest(); }}
            />
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client name (optional — personalises the reply)</Label>
                <Input className="w-56" placeholder="e.g. Thabo" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <Button onClick={suggest} disabled={thinking || !question.trim()}>
                {thinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Suggest reply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {asked && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Suggested reply
                {suggestion?.confidence != null && (
                  <Badge variant="secondary" className="ml-1">{Math.round((suggestion.confidence || 0) * 100)}% match</Badge>
                )}
                {suggestion?.ref && <Badge variant="outline" className="text-[10px]">{suggestion.ref}</Badge>}
              </CardTitle>
              {!suggestion && (
                <CardDescription>
                  No confident match{holding ? <> — you could hold with: <em>“{holding}”</em></> : ''}. Write the right answer below and hit <strong>Teach</strong>.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={5} placeholder="The reply to send — edit freely…"
                value={answer} onChange={(e) => setAnswer(e.target.value)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" disabled={!answer.trim()} onClick={() => copyAnswer(answer)}>
                  <Copy className="w-4 h-4 mr-1" /> Copy reply
                </Button>
                <Button size="sm" variant="outline" disabled={teaching || !answer.trim() || !question.trim()} onClick={teach}
                  title="Save this question → answer pair; the brain suggests it automatically next time.">
                  {teaching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-1" />}
                  Teach the brain
                </Button>
              </div>

              {alternates.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Other close answers</div>
                  {alternates.map((alt) => (
                    <div key={alt.ref} className="rounded border border-border p-3 text-sm flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-muted-foreground mb-1">{alt.ref} · {Math.round(alt.score * 100)}%</div>
                        <div className="break-words line-clamp-3">{alt.text}</div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setAnswer(alt.text)}>Use</Button>
                        <Button size="sm" variant="ghost" onClick={() => copyAnswer(alt.text)}><Copy className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Learned answers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4" /> Learned answers <Badge variant="secondary" className="ml-1">{learned.length}</Badge>
            </CardTitle>
            <CardDescription>Everything you’ve taught the brain. It reuses these for the same question — and for questions worded almost the same.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {learned.length === 0 && <p className="text-sm text-muted-foreground">None yet — suggest something, fix the answer, and hit “Teach the brain”.</p>}
            {learned.map((row) => (
              <div key={row.id} className={`rounded border border-border p-3 text-sm ${row.active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-xs truncate">Q: {row.sample_inbound || row.match_key}</div>
                    <div className="mt-1 break-words line-clamp-3">A: {row.message}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">used {row.hits}× · {format(new Date(row.created_at), 'dd MMM yyyy')}</div>
                  </div>
                  <Switch checked={row.active} onCheckedChange={() => toggleLearned(row)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminChatControl;
