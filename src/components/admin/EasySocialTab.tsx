import { useEffect, useState } from 'react';
import { Loader2, Save, Plus, Trash2, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_OPTIONS } from '@/lib/statusConfig';
import { useEasySocialSettings, useUpdateEasySocialSettings } from '@/hooks/useZtcSettings';

type Override = { status: string; tag: string };

const EasySocialTab = () => {
  const { data: settings, isLoading } = useEasySocialSettings();
  const update = useUpdateEasySocialSettings();
  const [active, setActive] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || hydrated) return;
    setActive(settings.active !== false);
    setApiKey(typeof settings.config?.api_key === 'string' ? settings.config.api_key : '');
    const m = settings.config?.tag_add_overrides ?? {};
    setOverrides(Object.entries(m).map(([status, tag]) => ({ status, tag: String(tag) })));
    setHydrated(true);
  }, [settings, hydrated]);

  const save = () => {
    const tag_add_overrides: Record<string, string> = {};
    for (const o of overrides) if (o.status && o.tag.trim()) tag_add_overrides[o.status] = o.tag.trim();
    const config: any = { ...(settings?.config ?? {}), tag_add_overrides };
    if (apiKey.trim()) config.api_key = apiKey.trim(); else delete config.api_key;
    update.mutate({ active, config });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Plug className="w-4 h-4 text-emerald-400" />
        <h2 className="text-lg font-semibold">EasySocial CRM Sync</h2>
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
            <div key={i} className="flex items-center gap-2">
              <Select value={o.status} onValueChange={(v) => setOverrides((p) => p.map((x, idx) => idx === i ? { ...x, status: v } : x))}>
                <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Status…" /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s: any) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={o.tag} onChange={(e) => setOverrides((p) => p.map((x, idx) => idx === i ? { ...x, tag: e.target.value } : x))} placeholder="EasySocial tag name" className="h-8 flex-1" />
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
