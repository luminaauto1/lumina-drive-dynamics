import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info, ListTodo, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  useDocumentSettings, useUpdateDocumentSettings,
  DEFAULT_DOCUMENT_SETTINGS, DEFAULT_DEAL_CHECKLIST_CONFIG, DEAL_CHECKLIST_SECTIONS,
  resolveDealChecklistConfig,
  type DocumentSettings, type DealChecklistConfig, type DealChecklistItem, type DealChecklistSectionKey,
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

/**
 * Settings → Deal Checklist: configure the items in the Deal Desk's 3-section
 * checklist (Car Preparation / Delivery Preparation / Payout). Saved into
 * document_settings.dealChecklistConfig (same save path as the other document
 * settings pages, e.g. AppearanceNavTab).
 */
const DealChecklistTab = () => {
  const { data, isLoading } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const [model, setModel] = useState<DealChecklistConfig>(DEFAULT_DEAL_CHECKLIST_CONFIG);
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

  const setSection = (key: DealChecklistSectionKey, items: DealChecklistItem[]) =>
    setModel((m) => ({ ...m, [key]: items }));

  const addItem = (key: DealChecklistSectionKey) => {
    const label = drafts[key].trim();
    if (!label) return;
    const taken = new Set(model[key].map((i) => i.key));
    setSection(key, [...model[key], { key: slugKey(label, taken), label }]);
    setDrafts((d) => ({ ...d, [key]: '' }));
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center gap-2">
        <ListTodo className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold">Deal Checklist</h2>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        These items appear in every deal's Checklist tab. Renaming keeps each item's saved progress and
        uploaded documents; removing an item hides it from deals (already-uploaded files stay in storage).
      </div>

      {DEAL_CHECKLIST_SECTIONS.map((sec) => {
        const items = model[sec.key];
        return (
          <Card key={sec.key}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.label}</span>
                <span className="text-[11px] text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
              </div>

              <div className="space-y-1">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-1.5">No items — this section is hidden on deals until you add one.</p>
                )}
                {items.map((it, ii) => (
                  <div key={it.key} className="flex items-center gap-2 rounded border border-border px-2 py-1">
                    <div className="flex flex-col">
                      <button type="button" onClick={() => setSection(sec.key, move(items, ii, -1))} disabled={ii === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move up">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => setSection(sec.key, move(items, ii, 1))} disabled={ii === items.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move down">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <Input
                      value={it.label}
                      onChange={(e) => setSection(sec.key, items.map((x, j) => (j === ii ? { ...x, label: e.target.value } : x)))}
                      className="h-8 text-sm flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{it.key}</span>
                    <button type="button" onClick={() => setSection(sec.key, items.filter((_, j) => j !== ii))}
                      className="text-muted-foreground hover:text-destructive" title="Remove item">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={drafts[sec.key]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [sec.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(sec.key); } }}
                  placeholder="New item label…"
                  className="h-8 text-sm flex-1"
                />
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1"
                  onClick={() => addItem(sec.key)} disabled={!drafts[sec.key].trim()}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={reset} disabled={update.isPending} className="gap-1 text-muted-foreground">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
        </Button>
        <Button size="sm" onClick={save} disabled={update.isPending || !dirty} className="gap-1">
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save checklist
        </Button>
      </div>
    </div>
  );
};

export default DealChecklistTab;
