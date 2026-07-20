import { useState } from 'react';
import { Loader2, Save, ListChecks, Info, Eye, EyeOff, SlidersHorizontal, Plus, Pencil, Trash2, UserCheck, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useStatusConfig,
  useStatusOverrides,
  useUpsertStatusOverride,
  useDeleteStatusOverride,
  type MergedStatus,
  type ClientStatus,
} from '@/hooks/useZtcSettings';
import { StatusEditModal } from '@/components/admin/StatusEditModal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

// Colour presets (shadcn/dark tokens) the admin can pick per status.
const COLOR_PRESETS: { label: string; cls: string }[] = [
  { label: 'Slate', cls: 'bg-muted text-muted-foreground border-border' },
  { label: 'Blue', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { label: 'Cyan', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { label: 'Amber', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { label: 'Green', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { label: 'Purple', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { label: 'Red', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

// Finance row — keeps the inline quick-edit of label/colour/order/visibility,
// and an "Edit…" affordance that opens the rich modal (comment gate, internal
// flag, EasySocial tag, WhatsApp auto-send — slug stays read-only).
// The inline "WhatsApp message" textarea is GONE (owner 2026-07-20): it edited
// the tap-to-chat pre-fill but read as the auto-send template, and its one-shot
// state made this Row's Save clobber modal saves. whatsapp_message is not in
// the payload, so the partial upsert leaves the column untouched.
const Row = ({ s, order, onEdit }: { s: MergedStatus; order: number; onEdit: (slug: string) => void }) => {
  const upsert = useUpsertStatusOverride();
  const [label, setLabel] = useState(s.label);
  const [cls, setCls] = useState(s.colorClass);
  const [sortOrder, setSortOrder] = useState(order);
  const [hidden, setHidden] = useState(s.hidden);
  // Re-seed the inline editors when the SERVER value changes — chiefly after the
  // rich modal saves this same slug. This Row has a stable key={s.value} and the
  // file uses no effects, so its state is otherwise frozen at mount and this
  // Row's Save would write stale values back. The snapshot is built from PROPS
  // only, so it can never fire off a local edit and clobber in-progress typing.
  const serverSnapshot = JSON.stringify([s.label, s.colorClass, order, s.hidden]);
  const [seed, setSeed] = useState(serverSnapshot);
  if (seed !== serverSnapshot) {
    setSeed(serverSnapshot);
    setLabel(s.label);
    setCls(s.colorClass);
    setSortOrder(order);
    setHidden(s.hidden);
  }
  const save = () =>
    upsert.mutate({
      slug: s.value,
      label,
      color_class: cls,
      sort_order: sortOrder,
      is_hidden: hidden,
    });
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'rounded border px-1.5 py-0.5 text-xs font-semibold ' + cls}>{label || s.value}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{s.value}</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onEdit(s.value)} className="h-7 gap-1" title="Edit rules (comment gate, internal, tag)">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Edit…
          </Button>
          <Button size="sm" onClick={save} disabled={upsert.isPending} className="h-7 gap-1">
            {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <div className="md:col-span-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Display label" className="h-8 text-sm" />
          </div>
          <Select value={cls} onValueChange={setCls}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Colour" /></SelectTrigger>
            <SelectContent>{COLOR_PRESETS.map((p) => <SelectItem key={p.cls} value={p.cls}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="h-8 w-20" title="Sort order" />
            <button type="button" onClick={() => setHidden((h) => !h)} title={hidden ? 'Hidden' : 'Visible'}
              className={'inline-flex items-center gap-1 text-xs ' + (hidden ? 'text-muted-foreground' : 'text-foreground')}>
              {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Client-status row — badge preview, label, colour, visibility, Edit, Delete.
const ClientRow = ({ c, onEdit }: { c: ClientStatus; onEdit: (slug: string) => void }) => {
  const del = useDeleteStatusOverride();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'rounded-md border px-1.5 py-0.5 text-xs font-semibold ' + c.colorClass}>{c.label}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{c.value}</span>
          {c.hidden && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><EyeOff className="w-3 h-3" /> hidden</span>}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onEdit(c.value)} className="h-7 gap-1">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
            disabled={del.isPending}
            className="h-7 gap-1 text-red-400 hover:text-red-300"
          >
            {del.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete client status?"
        description={`Delete client status "${c.label}"?`}
        onConfirm={() => { del.mutate(c.value); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
};

const StatusesTab = () => {
  const { merged, allClientStatuses } = useStatusConfig();
  const { isLoading } = useStatusOverrides();
  // Modal state: which editor is open, in which mode, on which slug.
  const [editor, setEditor] = useState<{ mode: 'finance' | 'client'; slug?: string } | null>(null);
  const [query, setQuery] = useState('');

  // Filter BOTH tracks by label OR slug — every whitespace-split term must match.
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (label: string, slug: string) =>
    terms.length === 0 || terms.every((t) => `${label} ${slug}`.toLowerCase().includes(t));
  const filteredClients = allClientStatuses.filter((c) => matches(c.label, c.value));
  const filteredMerged = merged
    .map((s, i) => ({ s, order: s.sortOrder ?? i }))
    .filter(({ s }) => matches(s.label, s.value));

  return (
    // Width comes from the page shell (SettingsPageLayout) — this page is 'wide'.
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Finance statuses</strong> have fixed keys (wired into the auto-mailer, WhatsApp notifications and pipeline lanes), but their
          presentation <em>and</em> rules — label, colour, order, visibility, WhatsApp message, comment gate, internal flag, EasySocial tag — are
          editable. <strong>Client statuses</strong> are free-form: add, rename, recolour and delete them freely; by default they leave the application
          in whatever lane its finance status puts it, but each one can optionally be pointed at a pipeline lane of its own.
        </span>
      </div>

      {/* Search — filters both the client + pipeline status lists by label or slug. */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search statuses…"
          className="pl-9 pr-9"
          aria-label="Search statuses"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Client Statuses panel — placed first so "Add client status" is reachable without scrolling past the finance list. */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold">Client Statuses</h3>
          </div>
          <Button size="sm" onClick={() => setEditor({ mode: 'client' })} className="h-7 gap-1">
            <Plus className="w-3.5 h-3.5" /> Add client status
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A second, customizable status track shown alongside the finance status. Independent of the finance pipeline.
        </p>
        <div className="mt-2 space-y-2">
          {allClientStatuses.length === 0
            ? <p className="text-xs text-muted-foreground py-3">No client statuses yet. Add one to start the track.</p>
            : filteredClients.length === 0
              ? <p className="text-xs text-muted-foreground py-3">No client statuses match “{query.trim()}”.</p>
              : filteredClients.map((c) => <ClientRow key={c.value} c={c} onEdit={(slug) => setEditor({ mode: 'client', slug })} />)}
        </div>
      </div>

      {/* Pipeline (finance) statuses */}
      <div className="space-y-2 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" />
          <h3 className="text-base font-semibold">Pipeline Statuses</h3>
        </div>
        <div className="space-y-2">
          {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            : filteredMerged.length === 0
              ? <p className="text-xs text-muted-foreground py-3">No pipeline statuses match “{query.trim()}”.</p>
              : filteredMerged.map(({ s, order }) => <Row key={s.value} s={s} order={order} onEdit={(slug) => setEditor({ mode: 'finance', slug })} />)}
        </div>
      </div>

      {editor && (
        <StatusEditModal initialMode={editor.mode} slug={editor.slug} onClose={() => setEditor(null)} />
      )}
    </div>
  );
};

export default StatusesTab;
