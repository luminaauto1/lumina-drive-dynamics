import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Send, Inbox, ListTodo, Sparkles, Settings as SettingsIcon, Trash2, Copy, Check,
  MessageCircle, Plug, Library as LibraryIcon, Link2, Clock, AlertTriangle, Save, ChevronRight,
  CalendarClock,
} from 'lucide-react';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { toast } from 'sonner';
import {
  useTaskOSInbox, useCaptureInbox, useDiscardInbox,
  useTaskOSTasks, useCreateTask, useUpdateTask,
  useTaskOSEntities, useCreateEntity, useEntityLinks,
  useTelegramStatus, useGenerateTelegramCode, useUnlinkTelegram,
  useTaskOSSettings, useUpdateTaskOSSettings, useTaskOSSpendToday,
  useTaskOSQuery, TaskOSTask, TaskOSEntity,
} from '@/hooks/useTaskOS';

const statusColor = (s: string) => {
  if (s === 'processed') return 'border-emerald-500/40 text-emerald-400';
  if (s === 'processing' || s === 'pending') return 'border-blue-500/40 text-blue-400';
  if (s === 'needs_review') return 'border-amber-500/40 text-amber-400';
  if (s === 'failed') return 'border-red-500/40 text-red-400';
  return 'border-zinc-600 text-muted-foreground';
};

// ---------------- INBOX ----------------
const InboxTab = () => {
  const { data: items = [], isLoading } = useTaskOSInbox();
  const capture = useCaptureInbox();
  const discard = useDiscardInbox();
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    capture.mutate(text.trim(), { onSuccess: () => setText('') });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <Textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Dump anything — a task, idea, reminder, person, note… AI will sort it."
          className="min-h-[72px] text-sm resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
        />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to capture</span>
          <Button size="sm" onClick={send} disabled={capture.isPending || !text.trim()}>
            {capture.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Capture
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nothing captured yet. Type above, or send a message to your linked Telegram.</p>
          ) : items.map((it) => {
            const ents = it.ai_result?.entities ?? [];
            return (
              <div key={it.id} className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm flex-1 whitespace-pre-wrap">{it.raw_text || `(${it.media_kind})`}</p>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${statusColor(it.status)}`}>{it.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex flex-wrap gap-1">
                    {ents.map((e: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">{e.type}: {e.title?.slice(0, 28)}</Badge>
                    ))}
                    {it.status === 'failed' && it.error_text && <span className="text-[9px] text-red-400">{it.error_text.slice(0, 60)}</span>}
                    {it.status === 'needs_review' && it.ai_result?.note && <span className="text-[9px] text-amber-400">{String(it.ai_result.note).slice(0, 70)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}</span>
                    <button onClick={() => discard.mutate(it.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

// ---------------- TASKS ----------------
const TasksTab = () => {
  const { data: tasks = [], isLoading } = useTaskOSTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = useState('');

  const add = () => { if (!title.trim()) return; create.mutate({ title: title.trim() }, { onSuccess: () => setTitle('') }); };
  // Open tasks already arrive priority-ordered from the engine; show that order.
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
  const done = tasks.filter((t) => t.status === 'done');

  // Convert an ISO timestamp to the value a <input type="datetime-local"> expects (local tz).
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const Row = ({ t }: { t: TaskOSTask }) => {
    const overdue = t.due_at && t.status !== 'done' && isPast(new Date(t.due_at));
    const reminderArmed = t.remind_at && !t.notified_at;
    const [resched, setResched] = useState(false);
    const applyReschedule = (val: string) => {
      if (!val) return;
      const iso = new Date(val).toISOString();
      // Move the due time and re-arm the reminder for the new time.
      update.mutate({ id: t.id, updates: { due_at: iso, remind_at: iso } }, {
        onSuccess: () => { setResched(false); toast.success('Task rescheduled'); },
      });
    };
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
        <Checkbox
          checked={t.status === 'done'}
          onCheckedChange={(c) => update.mutate({ id: t.id, updates: { status: c ? 'done' : 'todo' } })}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {overdue && <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400 gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> overdue</Badge>}
            {t.due_at && !overdue && <span className="text-[10px] text-amber-400">{format(new Date(t.due_at), 'dd MMM HH:mm')}</span>}
            {reminderArmed && <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400 gap-0.5"><Clock className="w-2.5 h-2.5" /> reminder</Badge>}
            {(t.escalation_level ?? 0) > 1 && <span className="text-[9px] text-red-400">nudged ×{t.escalation_level}</span>}
            {t.priority_score > 0 && <span className="text-[10px] text-muted-foreground">P{Math.round(t.priority_score)}</span>}
            <span className="text-[10px] text-muted-foreground">U{t.urgency}·I{t.importance}</span>
            {t.tags?.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="text-[9px]">{tag}</Badge>)}
          </div>
          {resched && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="datetime-local"
                defaultValue={t.due_at ? toLocalInput(t.due_at) : ''}
                onChange={(e) => applyReschedule(e.target.value)}
                className="h-7 text-xs rounded-md border border-border bg-background px-2"
              />
              <button onClick={() => setResched(false)} className="text-[10px] text-muted-foreground hover:text-foreground">cancel</button>
            </div>
          )}
        </div>
        {t.status !== 'done' && (
          <button
            onClick={() => setResched((s) => !s)}
            title="Reschedule"
            className={`mt-0.5 ${resched ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <Button size="sm" onClick={add} disabled={create.isPending || !title.trim()}>Add</Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : open.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No open tasks. Capture something or add one above.</p>
            : open.map((t) => <Row key={t.id} t={t} />)}
          {done.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground pt-3">Done ({done.length})</p>
              {done.slice(0, 20).map((t) => <Row key={t.id} t={t} />)}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// ---------------- LIBRARY (goals / projects / people / notes…) ----------------
const KIND_FILTERS: { label: string; kinds?: string[] }[] = [
  { label: 'All' },
  { label: 'Goals', kinds: ['goal'] },
  { label: 'Projects', kinds: ['project'] },
  { label: 'People', kinds: ['person', 'contact'] },
  { label: 'Notes', kinds: ['note', 'idea', 'memory', 'reference', 'journal', 'decision', 'risk', 'opportunity'] },
  { label: 'Events', kinds: ['event', 'meeting', 'deadline', 'reminder'] },
];
const NEW_KINDS = ['note', 'goal', 'project', 'person', 'idea', 'reminder', 'event'];

const EntityRow = ({ e }: { e: TaskOSEntity }) => {
  const [open, setOpen] = useState(false);
  const { data: links = [] } = useEntityLinks(open ? e.id : null);
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <button className="flex items-start justify-between gap-2 w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <p className="text-sm truncate">{e.title || '(untitled)'}</p>
          {e.body && <p className="text-[11px] text-muted-foreground line-clamp-2">{e.body}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary" className="text-[9px]">{e.kind}</Badge>
            {e.due_at && <span className="text-[10px] text-amber-400">{format(new Date(e.due_at), 'dd MMM HH:mm')}</span>}
            {e.tags?.slice(0, 3).map((tag) => <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>)}
          </div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 pt-2 border-t border-border">
          {links.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No links yet. The AI connects related items automatically as you capture.</p>
          ) : (
            <div className="space-y-1">
              {links.map((l: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{l.relation.replace(/_/g, ' ')}</span>
                  <span className="truncate">{l.title}</span>
                  <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{l.kind}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LibraryTab = () => {
  const [filterIdx, setFilterIdx] = useState(0);
  const filter = KIND_FILTERS[filterIdx];
  const { data: entities = [], isLoading } = useTaskOSEntities(filter.kinds);
  const create = useCreateEntity();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('note');

  const add = () => { if (!title.trim()) return; create.mutate({ kind, title: title.trim() }, { onSuccess: () => setTitle('') }); };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex flex-wrap gap-1">
          {KIND_FILTERS.map((f, i) => (
            <button key={f.label} onClick={() => setFilterIdx(i)}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${i === filterIdx ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            className="h-8 rounded-md border border-border bg-background text-xs px-2">
            {NEW_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add to library…" className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <Button size="sm" onClick={add} disabled={create.isPending || !title.trim()}>Add</Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : entities.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">Nothing here yet. Capture notes, goals, projects and people — the AI files them automatically.</p>
            : entities.map((e) => <EntityRow key={e.id} e={e} />)}
        </div>
      </ScrollArea>
    </div>
  );
};

// ---------------- ASK ----------------
const AskTab = () => {
  const ask = useTaskOSQuery();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; sources: string[] } | null>(null);
  const run = () => { if (!q.trim()) return; ask.mutate(q.trim(), { onSuccess: (d) => setAnswer(d) }); };
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask your second brain… e.g. what am I waiting on?"
          className="h-8 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
        <Button size="sm" onClick={run} disabled={ask.isPending || !q.trim()}>
          {ask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {ask.isPending ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : answer ? (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
                {answer.sources?.length > 0 && <p className="text-[10px] text-muted-foreground mt-2">{answer.sources.length} source(s)</p>}
              </div>
            ) : <p className="text-xs text-muted-foreground text-center py-8">Ask anything about your tasks, notes, people, and ideas. Powered by semantic + keyword search.</p>}
        </div>
      </ScrollArea>
    </div>
  );
};

// ---------------- SETTINGS ----------------
const SettingsTab = () => {
  const { data: status } = useTelegramStatus();
  const gen = useGenerateTelegramCode();
  const unlink = useUnlinkTelegram();
  const { data: settings } = useTaskOSSettings();
  const updateSettings = useUpdateTaskOSSettings();
  const { data: spend } = useTaskOSSpendToday();
  const [code, setCode] = useState<{ code: string; deep_link: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const [hour, setHour] = useState<number | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const effHour = hour ?? settings?.briefing_hour ?? 7;
  const effCap = cap ?? settings?.settings?.daily_ai_cap_usd ?? 2;
  const effTz = tz ?? settings?.timezone ?? 'Africa/Johannesburg';

  const copy = (s: string) => { navigator.clipboard.writeText(s); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const saveBriefing = () => updateSettings.mutate({ timezone: effTz, briefing_hour: effHour, daily_ai_cap_usd: effCap });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Telegram */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Telegram</h3>
          </div>
          {status?.linked ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-sm">✅ Connected{status.link?.telegram_username ? ` as @${status.link.telegram_username}` : ''}</p>
              <p className="text-xs text-muted-foreground">Everything you message the bot lands in your private inbox and is auto-organised. Voice notes are transcribed when enabled.</p>
              <Button size="sm" variant="outline" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
                {unlink.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plug className="w-4 h-4 mr-1" />} Disconnect
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <p className="text-xs text-muted-foreground">Link your own Telegram so you can capture on the go. Your data stays private to you.</p>
              {!code ? (
                <Button size="sm" onClick={() => gen.mutate(undefined, { onSuccess: (d) => setCode(d) })} disabled={gen.isPending}>
                  {gen.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plug className="w-4 h-4 mr-1" />} Connect Telegram
                </Button>
              ) : (
                <div className="space-y-2">
                  {code.deep_link ? (
                    <a href={code.deep_link} target="_blank" rel="noreferrer">
                      <Button size="sm" className="w-full"><MessageCircle className="w-4 h-4 mr-1" /> Open Telegram & link</Button>
                    </a>
                  ) : (
                    <p className="text-xs text-amber-400">Bot username not configured — send <code>/start {code.code}</code> to the bot manually.</p>
                  )}
                  <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1.5">
                    <span className="text-xs font-mono">{code.code}</span>
                    <button onClick={() => copy(code.code)} className="text-muted-foreground hover:text-foreground">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Code expires in 10 minutes. This panel switches to “Connected” automatically once you link.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Daily briefing + reminders */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold">Briefing & reminders</h3>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Briefing hour (0–23)</span>
                <Input type="number" min={0} max={23} value={effHour} onChange={(e) => setHour(Number(e.target.value))} className="h-8 text-sm" />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Daily AI budget ($)</span>
                <Input type="number" min={0} step={0.5} value={effCap} onChange={(e) => setCap(Number(e.target.value))} className="h-8 text-sm" />
              </label>
            </div>
            <label className="text-xs space-y-1 block">
              <span className="text-muted-foreground">Timezone</span>
              <Input value={effTz} onChange={(e) => setTz(e.target.value)} className="h-8 text-sm" placeholder="Africa/Johannesburg" />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Daily briefing + Monday weekly review go to your Telegram.</span>
              <Button size="sm" onClick={saveBriefing} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
              </Button>
            </div>
          </div>
        </div>

        {/* AI spend */}
        <div>
          <h3 className="text-sm font-semibold mb-2">AI usage today</h3>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold">${(spend?.total ?? 0).toFixed(3)}</span>
              <span className="text-xs text-muted-foreground">of ${Number(effCap).toFixed(2)} budget · {spend?.runs ?? 0} runs</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, ((spend?.total ?? 0) / Math.max(0.01, Number(effCap))) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Classification uses fast Haiku and escalates to Opus only when unsure. Hitting the budget pauses auto-organising (capture still works).</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

const TaskOSPanel = () => (
  <Tabs defaultValue="inbox" className="flex flex-col h-full">
    <div className="px-3 pt-3">
      <TabsList className="grid grid-cols-5 w-full h-9">
        <TabsTrigger value="inbox" className="text-xs gap-1"><Inbox className="w-3.5 h-3.5" /> Inbox</TabsTrigger>
        <TabsTrigger value="tasks" className="text-xs gap-1"><ListTodo className="w-3.5 h-3.5" /> Tasks</TabsTrigger>
        <TabsTrigger value="library" className="text-xs gap-1"><LibraryIcon className="w-3.5 h-3.5" /></TabsTrigger>
        <TabsTrigger value="ask" className="text-xs gap-1"><Sparkles className="w-3.5 h-3.5" /> Ask</TabsTrigger>
        <TabsTrigger value="settings" className="text-xs gap-1"><SettingsIcon className="w-3.5 h-3.5" /></TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="inbox" className="flex-1 mt-2 overflow-hidden"><InboxTab /></TabsContent>
    <TabsContent value="tasks" className="flex-1 mt-2 overflow-hidden"><TasksTab /></TabsContent>
    <TabsContent value="library" className="flex-1 mt-2 overflow-hidden"><LibraryTab /></TabsContent>
    <TabsContent value="ask" className="flex-1 mt-2 overflow-hidden"><AskTab /></TabsContent>
    <TabsContent value="settings" className="flex-1 mt-2 overflow-hidden"><SettingsTab /></TabsContent>
  </Tabs>
);

export default TaskOSPanel;
