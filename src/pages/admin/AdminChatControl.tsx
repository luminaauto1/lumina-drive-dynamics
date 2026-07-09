// Chat Control Panel — runs the EasySocial WhatsApp auto-responder from the
// site (per lumina-chat/docs/DASHBOARD-SPEC.md): stats grid, the "Answer all
// waiting chats" button (scans chats and fills the Outbox — EasySocial has no
// send API, so nothing goes out without a human), the Outbox approval queue
// (review/edit → copy into EasySocial → mark sent, or discard), the "needs
// you" escalation queue (type an answer → copy into EasySocial → learn &
// close), the learned-answers panel, and the responder settings (EasySocial
// token, active flag, live-sends switch — templates only).
// All heavy lifting happens in the chat-* edge functions; no secrets here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity, AlertTriangle, Bot, CheckCircle2, Copy, ExternalLink, Inbox, Loader2, MessageSquareText,
  Play, RefreshCw, Settings2, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  total?: number; read?: number; unread?: number;
  tags?: Record<string, number>; credit?: Record<string, number>;
  licence?: Record<string, number>; income?: Record<string, number>; journey?: Record<string, number>;
  openEscalations?: number; learnedReplies?: number; decisionsLast24h?: number;
  lastRun?: any; snapshotAt?: string | null; partial?: boolean;
  dryRun?: boolean; responderActive?: boolean; esTokenConfigured?: boolean;
  source?: string;
}
interface EscalationItem {
  id: number; lead_id: number | null; phone: string | null; name: string | null;
  inbound_text: string | null; reason: string | null; chat_url: string | null;
  status: string; created_at: string;
}
interface LearnedItem {
  id: number; match_key: string; sample_inbound: string | null; message: string;
  hits: number; active: boolean; created_at: string;
}
interface OutboxItem {
  id: number; lead_id: number | null; phone: string | null; name: string | null;
  inbound_text: string | null; outbound_text: string; action: string | null;
  reply_ref: string | null; created_at: string; chat_url: string | null;
}

const AdminChatControl = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<EscalationItem[]>([]);
  const [learned, setLearned] = useState<LearnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [batchDryRun, setBatchDryRun] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, { text: string; learn: boolean; sending?: boolean }>>({});
  // outbox (bot-proposed replies awaiting approval)
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [outboxEdits, setOutboxEdits] = useState<Record<number, string>>({});
  const [outboxBusy, setOutboxBusy] = useState<Record<number, boolean>>({});
  // settings
  const [cfg, setCfg] = useState<any>(null);
  const [savingCfg, setSavingCfg] = useState(false);

  const invoke = useCallback(async (fn: string, opts: any = {}) => {
    const { data, error } = await supabase.functions.invoke(fn, opts);
    if (error) throw new Error(error.message || `${fn} failed`);
    if (data && data.ok === false) throw new Error(data.error || `${fn} failed`);
    return data;
  }, []);

  const loadStats = useCallback(async () => {
    try { const d = await invoke('chat-stats'); setStats(d.stats || null); }
    catch (e: any) { toast.error(`Stats: ${e.message}`); }
  }, [invoke]);

  const loadQueue = useCallback(async () => {
    try { const d = await invoke('chat-escalations?status=open'); setQueue(d.items || []); }
    catch (e: any) { toast.error(`Queue: ${e.message}`); }
  }, [invoke]);

  const loadOutbox = useCallback(async () => {
    try { const d = await invoke('chat-escalations?view=outbox'); setOutbox(d.items || []); }
    catch (e: any) { toast.error(`Outbox: ${e.message}`); }
  }, [invoke]);

  const loadLearned = useCallback(async () => {
    try { const d = await invoke('chat-escalations?view=learned'); setLearned(d.items || []); }
    catch { /* panel is optional */ }
  }, [invoke]);

  const loadCfg = useCallback(async () => {
    const { data } = await (supabase as any).from('integration_settings').select('active, config').eq('key', 'chat_responder').maybeSingle();
    setCfg({ active: data ? data.active !== false : true, ...(data?.config || {}) });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadOutbox(), loadQueue(), loadLearned(), loadCfg()]);
      setLoading(false);
    })();
  }, [loadStats, loadOutbox, loadQueue, loadLearned, loadCfg]);

  // poll the outbox + queue every 30s per the spec
  useEffect(() => {
    const t = setInterval(() => { loadOutbox(); loadQueue(); }, 30000);
    return () => clearInterval(t);
  }, [loadOutbox, loadQueue]);

  const runBatch = async () => {
    setRunning(true);
    try {
      const d = await invoke('chat-run-batch', { body: { dryRun: batchDryRun } });
      const s = d.summary || {};
      toast.success(`${s.replied ?? 0} replies drafted to Outbox · ${s.escalated ?? 0} to Needs you · ${s.skipped ?? 0} skipped${s.dry_run ? ' (dry run)' : ''}`);
      await Promise.all([loadStats(), loadOutbox(), loadQueue()]);
    } catch (e: any) { toast.error(`Batch: ${e.message}`); }
    finally { setRunning(false); }
  };

  const refreshStats = async () => {
    setRefreshing(true);
    try {
      await invoke('chat-refresh-stats', { body: {} });
      await loadStats();
      toast.success('Stats refreshed from EasySocial');
    } catch (e: any) { toast.error(`Refresh: ${e.message}`); }
    finally { setRefreshing(false); }
  };

  // EasySocial has no send API — replies are copied into its chat UI by a human.
  const copyAndOpenChat = async (text: string, chatUrl: string | null, successMsg: string) => {
    if (!text) { toast.error('Nothing to copy — type or edit the reply first'); return; }
    try { await navigator.clipboard.writeText(text); toast.success(successMsg); }
    catch { toast.error('Copy failed — select the text and copy it manually'); }
    if (chatUrl) window.open(chatUrl, '_blank');
  };

  const outboxText = (item: OutboxItem) => (outboxEdits[item.id] ?? item.outbound_text ?? '').trim();

  const markOutboxSent = async (item: OutboxItem) => {
    const text = outboxText(item);
    if (!text) { toast.error('Reply text is empty'); return; }
    setOutboxBusy((p) => ({ ...p, [item.id]: true }));
    try {
      await invoke('chat-answer', { body: { approveReplyLogId: item.id, message: text } });
      setOutbox((p) => p.filter((x) => x.id !== item.id));
      setOutboxEdits((p) => { const n = { ...p }; delete n[item.id]; return n; });
      toast.success('Marked sent ✓');
    } catch (e: any) { toast.error(`Mark sent: ${e.message}`); }
    finally { setOutboxBusy((p) => { const n = { ...p }; delete n[item.id]; return n; }); }
  };

  const discardOutbox = async (item: OutboxItem) => {
    setOutboxBusy((p) => ({ ...p, [item.id]: true }));
    try {
      await invoke('chat-answer', { body: { discardReplyLogId: item.id } });
      setOutbox((p) => p.filter((x) => x.id !== item.id));
      setOutboxEdits((p) => { const n = { ...p }; delete n[item.id]; return n; });
      toast.success('Reply discarded');
    } catch (e: any) { toast.error(`Discard: ${e.message}`); }
    finally { setOutboxBusy((p) => { const n = { ...p }; delete n[item.id]; return n; }); }
  };

  // "Needs you" close: records the answer, optionally learns it, closes the
  // escalation — it does NOT send (the human pastes the copy into EasySocial).
  const doneLearnClose = async (item: EscalationItem) => {
    const d = drafts[item.id];
    if (!d || !d.text.trim()) { toast.error('Type an answer first'); return; }
    setDrafts((p) => ({ ...p, [item.id]: { ...d, sending: true } }));
    try {
      const r = await invoke('chat-answer', {
        body: {
          leadId: item.lead_id, phone: item.phone, inbound_text: item.inbound_text,
          message: d.text.trim(), escalationId: item.id, learn: d.learn,
        },
      });
      toast.success(`Closed ✓${r.learned ? ' · remembered' : ''}`);
      setQueue((p) => p.filter((x) => x.id !== item.id));
      setDrafts((p) => { const n = { ...p }; delete n[item.id]; return n; });
      loadLearned();
    } catch (e: any) {
      toast.error(`Close: ${e.message}`);
      setDrafts((p) => ({ ...p, [item.id]: { ...d, sending: false } }));
    }
  };

  const toggleLearned = async (row: LearnedItem) => {
    try {
      await invoke('chat-answer', { body: { toggleLearnedId: row.id, active: !row.active } });
      setLearned((p) => p.map((x) => (x.id === row.id ? { ...x, active: !row.active } : x)));
    } catch (e: any) { toast.error(e.message); }
  };

  const saveCfg = async (patch: any, confirmLive = false) => {
    if (confirmLive && patch.dry_run === false) {
      const sure = window.confirm(
        'Turn LIVE SENDS ON?\n\nThis only affects TEMPLATE messages (outside the 24h window). ' +
        'Chat replies still wait in the Outbox for your approval. ' +
        'Make sure the template endpoint has been verified (see lumina-chat/docs/RUNBOOK.md §6).',
      );
      if (!sure) return;
    }
    setSavingCfg(true);
    try {
      const next = { ...cfg, ...patch };
      const { active, ...config } = next;
      const { error } = await (supabase as any).from('integration_settings')
        .update({ active: active !== false, config })
        .eq('key', 'chat_responder');
      if (error) throw error;
      setCfg(next);
      toast.success('Responder settings saved');
      loadStats();
    } catch (e: any) { toast.error(`Save: ${e.message}`); }
    finally { setSavingCfg(false); }
  };

  const tagBars = useMemo(() => {
    const t = stats?.tags || {};
    const entries = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = entries.length ? entries[0][1] : 1;
    return { entries, max };
  }, [stats]);

  const dryRunActive = stats?.dryRun !== false;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" /> Chat Control Panel
              {dryRunActive
                ? <Badge variant="outline" className="ml-2 border-amber-500/60 text-amber-400">DRY RUN</Badge>
                : <Badge className="ml-2 bg-emerald-600">LIVE</Badge>}
              {stats?.responderActive === false && <Badge variant="destructive" className="ml-1">PAUSED</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              The bot drafts a reply for every new chat — nothing reaches a customer until you approve it in the <strong>Outbox</strong> below. Questions it won’t guess wait in the “Needs you” queue.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Switch checked={batchDryRun} onCheckedChange={setBatchDryRun} /> Dry-run
            </label>
            <Button
              onClick={runBatch} disabled={running || stats?.esTokenConfigured === false}
              title="Scans waiting chats and drafts replies into the Outbox for your approval — it does not message anyone directly."
            >
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Answer all waiting chats
            </Button>
            <Button variant="outline" onClick={refreshStats} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh stats
            </Button>
          </div>
        </div>

        {stats?.esTokenConfigured === false && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-amber-300">EasySocial token not set.</span>{' '}
              The realtime path and batch sweep need it — paste it in <em>Responder Settings</em> below
              (EasySocial web app → browser Local Storage → <code className="text-xs">token</code> and <code className="text-xs">device-id</code>).
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Total leads" value={stats?.total} icon={<Activity className="w-4 h-4" />} loading={loading} />
          <Tile label="Unread" value={stats?.unread} loading={loading} />
          <Tile
            label="Open escalations" value={stats?.openEscalations} loading={loading} accent
            onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth' })}
          />
          <Tile label="Decisions (24h)" value={stats?.decisionsLast24h} icon={<Sparkles className="w-4 h-4" />} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Leads by tag</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {tagBars.entries.length === 0 && <p className="text-sm text-muted-foreground">No snapshot yet — hit “Refresh stats”.</p>}
              {tagBars.entries.map(([tag, n]) => (
                <div key={tag} className="flex items-center gap-2 text-xs">
                  <span className="w-40 truncate text-muted-foreground">{tag}</span>
                  <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${Math.max(4, (n / tagBars.max) * 100)}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{n}</span>
                </div>
              ))}
              {stats?.partial && <p className="text-[11px] text-amber-400 mt-2">partial snapshot (time budget hit)</p>}
              {stats?.snapshotAt && <p className="text-[11px] text-muted-foreground mt-2">updated {format(new Date(stats.snapshotAt), 'dd MMM HH:mm')}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Client profiles (funnel answers)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MiniDist title="Credit" data={stats?.credit} />
              <MiniDist title="Licence" data={stats?.licence} />
              <MiniDist title="Income" data={stats?.income} />
            </CardContent>
          </Card>
        </div>

        {/* Outbox — approval queue (EasySocial has no send API; a human delivers) */}
        <Card id="outbox">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="w-4 h-4" /> Outbox — approve before it reaches the customer
              <Badge variant="secondary" className="ml-1">{outbox.length}</Badge>
            </CardTitle>
            <CardDescription>Replies the bot drafted. Edit if needed, copy into EasySocial and paste it to the client, then mark it sent — or discard it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && outbox.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nothing waiting for approval — run “Answer all waiting chats” to fill the outbox.
              </div>
            )}
            {outbox.map((item) => {
              const text = outboxEdits[item.id] ?? item.outbound_text ?? '';
              const busy = !!outboxBusy[item.id];
              return (
                <div key={item.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium">{item.name || 'Unknown'} <span className="text-muted-foreground font-normal">{item.phone || ''}</span></div>
                      <div className="text-sm mt-1 break-words text-muted-foreground">“{item.inbound_text || '(no text)'}”</div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        {item.reply_ref && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.reply_ref}</Badge>}
                        {item.action && <span>{item.action}</span>}
                        <span>{format(new Date(item.created_at), 'dd MMM HH:mm')}</span>
                      </div>
                    </div>
                    {item.chat_url && (
                      <a href={item.chat_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 shrink-0">
                        Open in EasySocial <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <Textarea
                    rows={2} className="w-full" value={text}
                    onChange={(e) => setOutboxEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" disabled={busy || !text.trim()} onClick={() => copyAndOpenChat(text.trim(), item.chat_url, 'Reply copied — paste it in EasySocial')}>
                      <Copy className="w-4 h-4 mr-1" /> Copy & open chat
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => markOutboxSent(item)}>
                      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Mark sent
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => discardOutbox(item)}>
                      Discard
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Needs-you queue */}
        <Card id="needs-you">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareText className="w-4 h-4" /> Needs you
              <Badge variant="secondary" className="ml-1">{queue.length}</Badge>
            </CardTitle>
            <CardDescription>Questions the bot won’t guess. Type an answer, copy it into EasySocial, then close it here — tick “Remember” and the bot handles it next time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && queue.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nothing waiting — the bot’s got it. 🎉
              </div>
            )}
            {queue.map((item) => {
              const d = drafts[item.id] || { text: '', learn: true };
              return (
                <div key={item.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium">{item.name || 'Unknown'} <span className="text-muted-foreground font-normal">{item.phone || ''}</span></div>
                      <div className="text-sm mt-1 break-words">“{item.inbound_text || '(no text)'}”</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {item.reason} · {format(new Date(item.created_at), 'dd MMM HH:mm')}
                      </div>
                    </div>
                    {item.chat_url && (
                      <a href={item.chat_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 shrink-0">
                        Open in EasySocial <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      rows={2} placeholder="Type your answer…" className="flex-1"
                      value={d.text}
                      onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: { ...d, text: e.target.value } }))}
                    />
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      <Button size="sm" disabled={d.sending || !d.text.trim()} onClick={() => copyAndOpenChat(d.text.trim(), item.chat_url, 'Answer copied — paste it in EasySocial')}>
                        <Copy className="w-4 h-4 mr-1" /> Copy & open chat
                      </Button>
                      <Button size="sm" variant="outline" disabled={d.sending || !d.text.trim()} onClick={() => doneLearnClose(item)}>
                        {d.sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Done — learn & close
                      </Button>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap">
                        <Checkbox checked={d.learn} onCheckedChange={(v) => setDrafts((p) => ({ ...p, [item.id]: { ...d, learn: v === true } }))} />
                        Remember this answer
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Learned answers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learned answers <Badge variant="secondary" className="ml-1">{learned.length}</Badge></CardTitle>
            <CardDescription>Answers you taught the bot. It reuses them for the same question — and for questions worded almost the same.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {learned.length === 0 && <p className="text-sm text-muted-foreground">None yet — answer something in the queue with “Remember” ticked.</p>}
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

        {/* Responder settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" /> Responder settings</CardTitle>
            <CardDescription>
              EasySocial connection + safety switches. Chat replies always go through your <strong>Outbox approval</strong> — the live-sends switch only affects template messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!cfg ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>EasySocial token</Label>
                    <Input
                      type="password" value={cfg.es_token || ''} placeholder="from Local Storage → token"
                      onChange={(e) => setCfg((p: any) => ({ ...p, es_token: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Device ID</Label>
                    <Input
                      value={cfg.es_device_id || ''} placeholder="from Local Storage → device-id"
                      onChange={(e) => setCfg((p: any) => ({ ...p, es_device_id: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={cfg.active !== false} onCheckedChange={(v) => saveCfg({ active: v })} disabled={savingCfg} />
                    Responder active
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={cfg.dry_run === false}
                      onCheckedChange={(v) => saveCfg({ dry_run: !v ? true : false }, true)}
                      disabled={savingCfg}
                    />
                    Live sends {cfg.dry_run === false ? <span className="text-emerald-400 text-xs">(ON — real messages!)</span> : <span className="text-amber-400 text-xs">(off — simulating)</span>}
                  </label>
                  <Button size="sm" variant="outline" disabled={savingCfg} onClick={() => saveCfg({ es_token: cfg.es_token, es_device_id: cfg.es_device_id })}>
                    {savingCfg ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Save connection
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Live sends only apply to <strong>template messages</strong> (outside the 24h window). Chat replies always go through your approval in the Outbox until the EasySocial chatbot connection is published.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pre-approved / validation clients (tags: Approved - Need Docs, Validations Pending, Vals Done) are never auto-answered — those stay yours.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

const Tile = ({ label, value, icon, loading, accent, onClick }: {
  label: string; value?: number; icon?: React.ReactNode; loading?: boolean; accent?: boolean; onClick?: () => void;
}) => (
  <button
    type="button" onClick={onClick}
    className={`rounded-lg border border-border p-4 text-left transition-colors ${onClick ? 'hover:border-primary/60 cursor-pointer' : 'cursor-default'} ${accent ? 'bg-primary/5' : 'bg-card'}`}
  >
    <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
    <div className="text-2xl font-bold mt-1 tabular-nums">{loading ? '…' : (value ?? '—')}</div>
  </button>
);

const MiniDist = ({ title, data }: { title: string; data?: Record<string, number> }) => {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{title}</div>
      {entries.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
      {entries.map(([k, n]) => (
        <div key={k} className="flex justify-between text-xs py-0.5">
          <span className="truncate mr-2">{k}</span><span className="tabular-nums text-muted-foreground">{n}</span>
        </div>
      ))}
    </div>
  );
};

export default AdminChatControl;
