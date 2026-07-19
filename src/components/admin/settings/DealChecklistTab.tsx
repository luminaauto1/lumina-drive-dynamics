import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info, ListTodo, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  useDocumentSettings, useUpdateDocumentSettings,
  DEFAULT_DOCUMENT_SETTINGS, DEFAULT_DEAL_CHECKLIST_CONFIG, DEAL_CHECKLIST_SECTIONS,
  resolveDealChecklistConfig,
  type DocumentSettings, type ResolvedDealChecklistConfig, type ResolvedDealChecklistItem,
  type DealChecklistSectionKey,
} from '@/hooks/useDocumentSettings';

/** Stable machine key from a new item's label, deduped within its section.
 *  Keys never change on rename so per-deal status + uploads stay attached. */
function slugKey(label: string, taken: Set<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** ONE grid template shared by the column header, every item row and the add
 *  row — that is what keeps the inputs, key chips, toggles and delete buttons
 *  lined up in a single column instead of drifting per row.
 *  Tracks are EXPLICIT (not `auto`): each row is its own grid container, so
 *  content-sized tracks would drift row to row — most visibly under the add
 *  row's column-spanning button. The transparent border matches the 1px border
 *  on item rows so the header/add rows sit on the same x positions. */
const ROW_GRID =
  'grid items-center gap-2 rounded-md border border-transparent px-2 ' +
  // The key column narrows first on small screens — the editable label must win
  // the space over a read-only technical id. The track count NEVER changes
  // across breakpoints: dropping a cell (display:none) would let grid
  // auto-placement slide the toggle into the key column and break the alignment.
  'grid-cols-[1.5rem_minmax(0,1fr)_4rem_2.75rem_1.75rem] ' +
  'sm:grid-cols-[1.5rem_minmax(0,1fr)_6rem_2.75rem_1.75rem] ' +
  'lg:grid-cols-[1.5rem_minmax(0,1fr)_8rem_2.75rem_1.75rem]';

/**
 * Settings → Deal Checklist: configure the items in the Deal Desk's 3-section
 * checklist (Car Preparation / Delivery Preparation / Payout). Saved into
 * document_settings.dealChecklistConfig (same save path as the other document
 * settings pages, e.g. AppearanceNavTab).
 */
const DealChecklistTab = () => {
  const { data, isLoading } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const [model, setModel] = useState<ResolvedDealChecklistConfig>(DEFAULT_DEAL_CHECKLIST_CONFIG);
  const [drafts, setDrafts] = useState<Record<DealChecklistSectionKey, string>>({
    car_prep: '', delivery_prep: '', payout: '',
  });

  useEffect(() => {
    if (data) setModel(resolveDealChecklistConfig(data.dealChecklistConfig));
  }, [data]);

  const dirty = useMemo(
    () => JSON.stringify(resolveDealChecklistConfig(data?.dealChecklistConfig)) !== JSON.stringify(model),
    [data?.dealChecklistConfig, model],
  );

  const save = () => {
    const base: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(data || {}) };
    update.mutate({ ...base, dealChecklistConfig: model });
  };

  const reset = () => {
    const base: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(data || {}) };
    update.mutate({ ...base, dealChecklistConfig: DEFAULT_DEAL_CHECKLIST_CONFIG });
  };

  const setSection = (key: DealChecklistSectionKey, items: ResolvedDealChecklistItem[]) =>
    setModel((m) => ({ ...m, [key]: items }));

  const patchItem = (key: DealChecklistSectionKey, index: number, patch: Partial<ResolvedDealChecklistItem>) =>
    setSection(key, model[key].map((x, j) => (j === index ? { ...x, ...patch } : x)));

  const addItem = (key: DealChecklistSectionKey) => {
    const label = drafts[key].trim();
    if (!label) return;
    const taken = new Set(model[key].map((i) => i.key));
    // New items default to requiring a document — matches every pre-existing item.
    setSection(key, [...model[key], { key: slugKey(label, taken), label, requiresDoc: true }]);
    setDrafts((d) => ({ ...d, [key]: '' }));
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold">Deal Checklist</h2>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            These items appear in every deal's Checklist tab. Renaming keeps each item's saved progress and
            uploaded documents; removing an item hides it from deals (already-uploaded files stay in storage).
            Turn <span className="font-medium text-foreground">Docs</span> off for physical tasks that have no
            paperwork — those items then show a status only, with no upload button.
          </span>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {DEAL_CHECKLIST_SECTIONS.map((sec) => {
          const items = model[sec.key];
          return (
            <Card key={sec.key}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{sec.label}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {items.length} item{items.length === 1 ? '' : 's'}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    No items — this section is hidden on deals until you add one.
                  </p>
                ) : (
                  <div className={`${ROW_GRID} text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
                    <span aria-hidden />
                    <span>Item label</span>
                    <span className="text-right">Key</span>
                    <span className="text-center">Docs</span>
                    <span aria-hidden />
                  </div>
                )}

                <div className="space-y-2">
                  {items.map((it, ii) => (
                    <div key={it.key} className={`${ROW_GRID} border-border bg-card py-1.5`}>
                      <div className="flex flex-col items-center">
                        <button
                          type="button" title="Move up" aria-label={`Move ${it.label} up`}
                          onClick={() => setSection(sec.key, move(items, ii, -1))} disabled={ii === 0}
                          className="rounded text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button" title="Move down" aria-label={`Move ${it.label} down`}
                          onClick={() => setSection(sec.key, move(items, ii, 1))} disabled={ii === items.length - 1}
                          className="rounded text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>

                      <Input
                        value={it.label}
                        onChange={(e) => patchItem(sec.key, ii, { label: e.target.value })}
                        aria-label="Item label"
                        className="h-8 w-full text-sm"
                      />

                      <span
                        title={it.key}
                        className="truncate rounded bg-muted px-1.5 py-0.5 text-right font-mono text-[10px] text-muted-foreground"
                      >
                        {it.key}
                      </span>

                      <div className="flex justify-center">
                        <Switch
                          checked={it.requiresDoc}
                          onCheckedChange={(v) => patchItem(sec.key, ii, { requiresDoc: v })}
                          aria-label={`Require a document for ${it.label}`}
                          title={it.requiresDoc
                            ? 'Deals ask for a document upload on this item'
                            : 'Status only — deals show no upload button for this item'}
                        />
                      </div>

                      <button
                        type="button" title="Remove item" aria-label={`Remove ${it.label}`}
                        onClick={() => setSection(sec.key, items.filter((_, j) => j !== ii))}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className={`${ROW_GRID} mt-1`}>
                  <span aria-hidden />
                  <Input
                    value={drafts[sec.key]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [sec.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(sec.key); } }}
                    placeholder="New item label…"
                    aria-label={`New ${sec.label} item label`}
                    className="h-8 w-full text-sm"
                  />
                  <Button
                    type="button" variant="outline" size="sm"
                    className="col-span-3 h-8 justify-self-end gap-1"
                    onClick={() => addItem(sec.key)} disabled={!drafts[sec.key].trim()}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <span className="mr-auto text-xs text-muted-foreground">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <Button variant="ghost" size="sm" onClick={reset} disabled={update.isPending} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
        </Button>
        <Button size="sm" onClick={save} disabled={update.isPending || !dirty} className="gap-1">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save checklist
        </Button>
      </div>
    </div>
  );
};

export default DealChecklistTab;
