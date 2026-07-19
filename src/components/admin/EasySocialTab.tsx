import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Plus, Trash2, Plug, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_OPTIONS } from '@/lib/statusConfig';
import { useEasySocialSettings, useUpdateEasySocialSettings } from '@/hooks/useZtcSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Override = { status: string; tag: string };
type CachedTag = { name: string; id: number };

// Shared <datalist> id for the tag autocomplete (sourced from config.tags_cache).
const TAG_DATALIST_ID = 'easysocial-tag-cache';

const EasySocialTab = () => {
  const { data: settings, isLoading } = useEasySocialSettings();
  const update = useUpdateEasySocialSettings();
  const qc = useQueryClient();
  const [active, setActive] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // Cached tag dictionary (name → id) populated by the easysocial-list-tags
  // function. Backward-safe: when empty, the tag fields stay plain free-text.
  const cachedTags: CachedTag[] = useMemo(() => {
    const raw = (settings?.config as any)?.tags_cache;
    return Array.isArray(raw)
      ? raw.filter((t: any) => t && typeof t.name === 'string')
      : [];
  }, [settings]);
  const tagsSyncedAt: string | null = (settings?.config as any)?.tags_synced_at ?? null;

  useEffect(() => {
    if (!settings || hydrated) return;
    setActive(settings.active !== false);
    setApiKey(typeof settings.config?.api_key === 'string' ? settings.config.api_key : '');
    const m = settings.config?.tag_add_overrides ?? {};
    setOverrides(Object.entries(m).map(([status, tag]) => ({ status, tag: String(tag) })));
    setHydrated(true);
  }, [settings, hydrated]);

  // Pull the live tag list from EasySocial (admin-only edge function). On success
  // the function persists config.tags_cache + tags_synced_at, so we refetch the
  // settings query to surface the new dictionary in the pickers.
  const syncTags = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('easysocial-list-tags');
      if (error) throw error;
      if (data && (data as any).ok === false) {
        throw new Error((data as any).detail || (data as any).error || 'Tag sync failed');
      }
      const count = (data as any)?.count ?? 0;
      await qc.invalidateQueries({ queryKey: ['integration', 'easysocial'] });
      toast.success(`Synced ${count} tag${count === 1 ? '' : 's'} from EasySocial`);
    } catch (e: any) {
      toast.error('Tag sync failed: ' + (e?.message || e));
    } finally {
      setSyncing(false);
    }
  };

  const save = () => {
    const tag_add_overrides: Record<string, string> = {};
    for (const o of overrides) if (o.status && o.tag.trim()) tag_add_overrides[o.status] = o.tag.trim();
    const config: any = { ...(settings?.config ?? {}), tag_add_overrides };
    if (apiKey.trim()) config.api_key = apiKey.trim(); else delete config.api_key;
    update.mutate({ active, config });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    // Width comes from the page shell (SettingsPageLayout) — no inner cap, or the
    // body would be pinned left inside the centered column.
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Plug className="w-4 h-4 text-emerald-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CRM sync</h2>
      </div>

      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Sync active</Label>
              <p className="text-xs text-muted-foreground">When off, status changes no longer push CRM tags to EasySocial (capture &amp; notifications are unaffected).</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">API key (leave blank to use the built-in key)</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="eSt…" className="mt-1 font-mono text-xs" type="password" />
          </div>
        </CardContent>
      </Card>

      {/* Tag library — pull the live tag list so the override pickers are validated. */}
      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Tag library</CardTitle>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={syncTags} disabled={syncing}>
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync tags from EasySocial
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {cachedTags.length > 0
              ? <>Synced {cachedTags.length} tag{cachedTags.length === 1 ? '' : 's'}{tagsSyncedAt ? <> · {new Date(tagsSyncedAt).toLocaleString()}</> : null}. The tag fields below autocomplete from this list.</>
              : <>No tags synced yet. Click <em>Sync tags from EasySocial</em> to pull the live list; until then the tag fields stay free-text.</>}
          </p>
          {cachedTags.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowTags((v) => !v)}
                aria-expanded={showTags}
                className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-foreground/80 transition-colors"
              >
                {showTags
                  ? <>Hide tags <ChevronUp className="w-3.5 h-3.5" /></>
                  : <>View all {cachedTags.length} tags <ChevronDown className="w-3.5 h-3.5" /></>}
              </button>
              {showTags && (
                <div className="mt-2 flex flex-wrap gap-1.5 rounded-md border border-border bg-muted/40 p-2 max-h-64 overflow-y-auto">
                  {cachedTags.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                    >
                      {t.name}
                      <span className="text-muted-foreground">#{t.id}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Autocomplete source for the override tag inputs (free-text still allowed). */}
      <datalist id={TAG_DATALIST_ID}>
        {cachedTags.map((t) => <option key={t.id} value={t.name} />)}
      </datalist>

      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Status → tag overrides</CardTitle>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setOverrides((p) => [...p, { status: '', tag: '' }])}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Optional. Remap which EasySocial tag is <em>added</em> for a given status. Leave empty to use the built-in mapping.</p>
          {overrides.length === 0 && <p className="text-xs text-muted-foreground py-2">No overrides — using the default tag flow.</p>}
          {overrides.map((o, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto]">
              <Select value={o.status} onValueChange={(v) => setOverrides((p) => p.map((x, idx) => idx === i ? { ...x, status: v } : x))}>
                <SelectTrigger className="h-8 col-span-2 sm:col-span-1"><SelectValue placeholder="Status…" /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s: any) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input
                value={o.tag}
                onChange={(e) => setOverrides((p) => p.map((x, idx) => idx === i ? { ...x, tag: e.target.value } : x))}
                placeholder="EasySocial tag name"
                className="h-8"
                list={cachedTags.length > 0 ? TAG_DATALIST_ID : undefined}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOverrides((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={update.isPending} className="gap-2">
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save EasySocial settings
        </Button>
      </div>
    </div>
  );
};

export default EasySocialTab;
