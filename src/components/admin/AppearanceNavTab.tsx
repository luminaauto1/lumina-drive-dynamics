import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Eye, EyeOff, ChevronUp, ChevronDown, LayoutDashboard, Info, RotateCcw, Sun, Moon, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  useDocumentSettings, useUpdateDocumentSettings, DEFAULT_DOCUMENT_SETTINGS,
  type DocumentSettings, type NavConfig,
} from '@/hooks/useDocumentSettings';
import { NAV_SECTIONS } from '@/components/admin/AdminSidebar';
import { sectionId, itemId } from '@/lib/navConfig';
import { useDeskTheme, type DeskTheme } from '@/hooks/useDeskTheme';
import { useAdminDensity, type AdminDensity } from '@/hooks/useAdminDensity';

// Editable model: ordered sections, each with ordered items + hidden flags.
// Built by merging the code defaults (NAV_SECTIONS) with the saved nav config so
// new code-added entries always appear (appended) and stale ids are dropped.
interface EditItem { id: string; title: string; hidden: boolean }
interface EditSection { id: string; label: string; hidden: boolean; items: EditItem[] }

function orderIds(defaultIds: string[], saved?: string[]): string[] {
  if (!saved || saved.length === 0) return defaultIds;
  const valid = new Set(defaultIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of saved) if (valid.has(id) && !seen.has(id)) { out.push(id); seen.add(id); }
  for (const id of defaultIds) if (!seen.has(id)) out.push(id);
  return out;
}

function buildModel(cfg?: NavConfig | null): EditSection[] {
  const secById = new Map(NAV_SECTIONS.map((s) => [sectionId(s), s]));
  const secOrder = orderIds(NAV_SECTIONS.map(sectionId), cfg?.sectionOrder);
  return secOrder.map((sid) => {
    const def = secById.get(sid)!;
    const secOv = cfg?.sections?.[sid];
    const itemById = new Map(def.items.map((i) => [itemId(i), i]));
    const itemOrder = orderIds(def.items.map(itemId), secOv?.order);
    return {
      id: sid,
      label: def.label,
      hidden: !!secOv?.hidden,
      items: itemOrder.map((iid) => {
        const di = itemById.get(iid)!;
        return { id: iid, title: di.title, hidden: !!secOv?.items?.[iid]?.hidden };
      }),
    };
  });
}

function toConfig(model: EditSection[]): NavConfig {
  return {
    sectionOrder: model.map((s) => s.id),
    sections: Object.fromEntries(
      model.map((s) => [
        s.id,
        {
          hidden: s.hidden,
          order: s.items.map((i) => i.id),
          items: Object.fromEntries(s.items.map((i) => [i.id, { hidden: i.hidden }])),
        },
      ]),
    ),
  };
}

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

const AppearanceNavTab = () => {
  const { data, isLoading } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const [model, setModel] = useState<EditSection[]>([]);
  const { theme, setTheme } = useDeskTheme();
  const { density, setDensity } = useAdminDensity();

  useEffect(() => { if (data) setModel(buildModel(data.navConfig)); }, [data]);

  const dirty = useMemo(
    () => JSON.stringify(buildModel(data?.navConfig)) !== JSON.stringify(model),
    [data?.navConfig, model],
  );

  const save = () => {
    const base: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(data || {}) };
    update.mutate({ ...base, navConfig: toConfig(model) });
  };

  const reset = () => {
    const base: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(data || {}) };
    update.mutate({ ...base, navConfig: {} });
  };

  const moveSection = (i: number, dir: -1 | 1) => setModel((m) => move(m, i, dir));
  const toggleSection = (i: number) =>
    setModel((m) => m.map((s, idx) => (idx === i ? { ...s, hidden: !s.hidden } : s)));
  const moveItem = (si: number, ii: number, dir: -1 | 1) =>
    setModel((m) => m.map((s, idx) => (idx === si ? { ...s, items: move(s.items, ii, dir) } : s)));
  const toggleItem = (si: number, ii: number) =>
    setModel((m) =>
      m.map((s, idx) =>
        idx === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, hidden: !it.hidden } : it)) } : s,
      ),
    );

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold">Appearance & Navigation</h2>
      </div>

      {/* Appearance — admin theme + density (moved here from the sidebar footer). */}
      <Card>
        <CardContent className="py-3 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</span>

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-foreground">Theme</div>
              <p className="text-xs text-muted-foreground">
                Choose the admin dashboard's colour scheme. Saved on this device.
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={theme}
              onValueChange={(v) => { if (v) setTheme(v as DeskTheme); }}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              <ToggleGroupItem value="light" aria-label="Light mode" className="gap-1.5">
                <Sun className="h-3.5 w-3.5" /> Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-1.5">
                <Moon className="h-3.5 w-3.5" /> Dark
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-foreground">Density</div>
              <p className="text-xs text-muted-foreground">
                Compact tightens spacing to fit more on screen; Comfortable adds breathing room.
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={density}
              onValueChange={(v) => { if (v) setDensity(v as AdminDensity); }}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              <ToggleGroupItem value="comfortable" aria-label="Comfortable density" className="gap-1.5">
                <Rows3 className="h-3.5 w-3.5" /> Comfortable
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" aria-label="Compact density" className="gap-1.5">
                <Rows3 className="h-3.5 w-3.5" /> Compact
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Reorder and hide the sidebar sections and links for everyone. Role-based access still applies on top of this — hiding a link
        here only affects the sidebar, and staff still can't reach pages their role doesn't grant.
      </div>

      {model.map((s, si) => (
        <Card key={s.id} className={s.hidden ? 'opacity-60' : ''}>
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => moveSection(si, -1)} disabled={si === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move section up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => moveSection(si, 1)} disabled={si === model.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move section down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">{s.label}</span>
              <button type="button" onClick={() => toggleSection(si)} title={s.hidden ? 'Section hidden' : 'Section visible'}
                className={'inline-flex items-center gap-1 text-xs ' + (s.hidden ? 'text-muted-foreground' : 'text-foreground')}>
                {s.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="space-y-1 pl-6">
              {s.items.map((it, ii) => (
                <div key={it.id} className={'flex items-center gap-2 rounded border border-border px-2 py-1 ' + (it.hidden ? 'opacity-50' : '')}>
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveItem(si, ii, -1)} disabled={ii === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move up">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => moveItem(si, ii, 1)} disabled={ii === s.items.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move down">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-sm flex-1">{it.title}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{it.id}</span>
                  <button type="button" onClick={() => toggleItem(si, ii)} title={it.hidden ? 'Hidden' : 'Visible'}
                    className={'inline-flex items-center gap-1 text-xs ' + (it.hidden ? 'text-muted-foreground' : 'text-foreground')}>
                    {it.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={reset} disabled={update.isPending} className="gap-1 text-muted-foreground">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
        </Button>
        <Button size="sm" onClick={save} disabled={update.isPending || !dirty} className="gap-1">
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save navigation
        </Button>
      </div>
    </div>
  );
};

export default AppearanceNavTab;
