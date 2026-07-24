import { useState } from 'react';
import { Loader2, ListChecks, Info, Eye, EyeOff, Plus, Pencil, Trash2, UserCheck, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

// Finance (pipeline) row — compact card matching the client-status row (owner
// 2026-07-24): badge + slug + Edit + a delete/restore action. All editing —
// label, colour, visibility, comment gate, timer, F&I notes, lane, etc. — lives
// in the rich StatusEditModal (Edit); the slug stays read-only.
//
// Finance statuses are fixed pipeline contracts, so "delete" can't remove one.
// The trash button HIDES it instead (is_hidden=true): filterStatusOptionsForRole
// then drops it from every status-change dropdown, and this list hides it behind
// "Show hidden" — fully reversible via Restore. A partial upsert of just
// { slug, is_hidden } leaves every other column untouched.
const FinanceRow = ({ s, onEdit }: { s: MergedStatus; onEdit: (slug: string) => void }) => {
  const upsert = useUpsertStatusOverride();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const setHidden = (hidden: boolean) => upsert.mutate({ slug: s.value, is_hidden: hidden });
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'rounded border px-1.5 py-0.5 text-xs font-semibold ' + s.colorClass}>{s.label || s.value}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{s.value}</span>
          {s.hidden && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><EyeOff className="w-3 h-3" /> hidden</span>}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onEdit(s.value)} className="h-7 gap-1">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          {s.hidden ? (
            <Button size="sm" variant="outline" onClick={() => setHidden(false)} disabled={upsert.isPending} className="h-7 gap-1" title="Restore this status">
              {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Restore
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={upsert.isPending} className="h-7 gap-1 text-red-400 hover:text-red-300" title="Hide (remove from use)">
              {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        title="Hide finance status?"
        description={`Hide "${s.label || s.value}"? It's removed from the status dropdowns staff pick from and from this list — any lead already in it is unaffected. Restore it any time with "Show hidden".`}
        confirmLabel="Hide"
        destructive={false}
        onConfirm={() => { setHidden(true); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
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
  // Hidden ("deleted") finance statuses are collapsed by default; this reveals
  // them so they can be restored.
  const [showHidden, setShowHidden] = useState(false);

  // Filter BOTH tracks by label OR slug — every whitespace-split term must match.
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (label: string, slug: string) =>
    terms.length === 0 || terms.every((t) => `${label} ${slug}`.toLowerCase().includes(t));
  const filteredClients = allClientStatuses.filter((c) => matches(c.label, c.value));
  const hiddenFinanceCount = merged.filter((s) => s.hidden).length;
  const filteredMerged = merged
    .filter((s) => showHidden || !s.hidden)   // hidden finance statuses collapse by default
    .filter((s) => matches(s.label, s.value));

  return (
    // Width comes from the page shell (SettingsPageLayout) — this page is 'wide'.
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Finance statuses</strong> have fixed keys (wired into the auto-mailer, WhatsApp notifications and pipeline lanes), so they can't be
          deleted — but everything else (label, colour, visibility, comment gate, F&amp;I notes, EasySocial tag, …) is editable via <strong>Edit</strong>.
          The <strong>trash</strong> button <em>hides</em> a finance status: it drops out of the status dropdowns staff pick from and this list, and is
          restorable any time via <strong>Show hidden</strong>. <strong>Client statuses</strong> are free-form: add, rename, recolour and delete them
          freely; by default they leave the application in whatever lane its finance status puts it, but each one can optionally be pointed at a pipeline lane of its own.
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold">Pipeline Statuses</h3>
          </div>
          {hiddenFinanceCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowHidden((v) => !v)} className="h-7 gap-1 text-xs text-muted-foreground">
              {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showHidden ? 'Hide hidden' : `Show hidden (${hiddenFinanceCount})`}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            : filteredMerged.length === 0
              ? <p className="text-xs text-muted-foreground py-3">No pipeline statuses match “{query.trim()}”.</p>
              : filteredMerged.map((s) => <FinanceRow key={s.value} s={s} onEdit={(slug) => setEditor({ mode: 'finance', slug })} />)}
        </div>
      </div>

      {editor && (
        <StatusEditModal initialMode={editor.mode} slug={editor.slug} onClose={() => setEditor(null)} />
      )}
    </div>
  );
};

export default StatusesTab;
