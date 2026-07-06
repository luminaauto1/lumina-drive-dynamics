import { useState } from 'react';
import { Loader2, Save, ListChecks, Info, Eye, EyeOff, MessageCircle, SlidersHorizontal, Plus, Pencil, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { getWhatsAppMessage } from '@/lib/statusConfig';
import { StatusEditModal } from '@/components/admin/StatusEditModal';

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

// Finance row — keeps the inline quick-edit of label/colour/order/visibility/WA,
// and an "Edit…" affordance that opens the rich modal (comment gate, internal
// flag, EasySocial tag — slug stays read-only).
const Row = ({ s, order, onEdit }: { s: MergedStatus; order: number; onEdit: (slug: string) => void }) => {
  const upsert = useUpsertStatusOverride();
  const [label, setLabel] = useState(s.label);
  const [cls, setCls] = useState(s.colorClass);
  const [sortOrder, setSortOrder] = useState(order);
  const [hidden, setHidden] = useState(s.hidden);
  const [waMessage, setWaMessage] = useState(s.whatsappMessage);
  // The built-in copy this status would send if the custom body is left blank.
  const builtInPreview = getWhatsAppMessage(s.value, '{name}');
  const save = () =>
    upsert.mutate({
      slug: s.value,
      label,
      color_class: cls,
      sort_order: sortOrder,
      is_hidden: hidden,
      // Empty => NULL so the built-in default is used (current behaviour preserved).
      whatsapp_message: waMessage.trim() ? waMessage : null,
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
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mb-1">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp message
            <span className="text-muted-foreground font-normal">— blank uses the built-in default; <code className="font-mono">{'{name}'}</code> = client first name</span>
          </div>
          <Textarea
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            rows={2}
            className="text-sm"
            placeholder={builtInPreview}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Client-status row — badge preview, label, colour, visibility, Edit, Delete.
const ClientRow = ({ c, onEdit }: { c: ClientStatus; onEdit: (slug: string) => void }) => {
  const del = useDeleteStatusOverride();
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
            onClick={() => { if (window.confirm(`Delete client status "${c.label}"?`)) del.mutate(c.value); }}
            disabled={del.isPending}
            className="h-7 gap-1 text-red-400 hover:text-red-300"
          >
            {del.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusesTab = () => {
  const { merged, allClientStatuses } = useStatusConfig();
  const { isLoading } = useStatusOverrides();
  // Modal state: which editor is open, in which mode, on which slug.
  const [editor, setEditor] = useState<{ mode: 'finance' | 'client'; slug?: string } | null>(null);

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300 [.desk-portal-light_&]:text-amber-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Finance statuses</strong> have fixed keys (wired into the auto-mailer, WhatsApp notifications and pipeline lanes), but their
          presentation <em>and</em> rules — label, colour, order, visibility, WhatsApp message, comment gate, internal flag, EasySocial tag — are
          editable. <strong>Client statuses</strong> are free-form: add, rename, recolour and delete them freely; they never move pipeline lanes
          and never fire client notifications.
        </span>
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
            : allClientStatuses.map((c) => <ClientRow key={c.value} c={c} onEdit={(slug) => setEditor({ mode: 'client', slug })} />)}
        </div>
      </div>

      {/* Pipeline (finance) statuses */}
      <div className="pt-4 flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold">Pipeline Statuses</h2>
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : merged.map((s, i) => <Row key={s.value} s={s} order={s.sortOrder ?? i} onEdit={(slug) => setEditor({ mode: 'finance', slug })} />)}

      {editor && (
        <StatusEditModal initialMode={editor.mode} slug={editor.slug} onClose={() => setEditor(null)} />
      )}
    </div>
  );
};

export default StatusesTab;
