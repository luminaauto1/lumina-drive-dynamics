// Admin → Settings → Signio Links — manage the Signio portal links used by the
// Deal Room's "Push to Signio" button, and declare which fill SYSTEM each link's
// form uses (one-page LIGHTSTONE vs 7-step wizard). The default link is what the
// button opens; the chosen system rides along in the payload as a hint for the
// auto-fill engine (which still auto-detects the form as a fallback, so a wrong
// choice degrades to a slower fill — never a broken one).
import { useEffect, useState } from 'react';
import { Loader2, Save, Plus, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useSignioLinks, useUpdateSignioLinks, DEFAULT_SIGNIO_LINKS,
  type SignioLink, type SignioSystem,
} from '@/hooks/useZtcSettings';

const SYSTEM_LABEL: Record<SignioSystem, string> = {
  lightstone: 'One-page (LIGHTSTONE)',
  wizard: '7-step wizard',
};

const newId = () => 'link_' + Math.random().toString(36).slice(2, 10);

const SignioLinksTab = () => {
  const { isLoading, links: effectiveLinks, defaultLink } = useSignioLinks();
  const update = useUpdateSignioLinks();
  const [rows, setRows] = useState<SignioLink[]>([]);
  const [defaultId, setDefaultId] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate once the query SETTLES (success or error — on error the effective
    // list is the built-in defaults, so the editor stays usable instead of
    // spinning forever). Starts from what the button would actually use.
    if (hydrated || isLoading) return;
    setRows(effectiveLinks.map((l) => ({ ...l })));
    setDefaultId(defaultLink?.id ?? effectiveLinks[0]?.id ?? '');
    setHydrated(true);
  }, [isLoading, hydrated, effectiveLinks, defaultLink]);

  const setRow = (i: number, patch: Partial<SignioLink>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    const id = newId();
    setRows((rs) => [...rs, { id, label: '', url: '', system: 'lightstone' }]);
    if (!rows.length) setDefaultId(id);
  };

  const removeRow = (i: number) => {
    const removed = rows[i];
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    if (removed?.id === defaultId) setDefaultId(next[0]?.id ?? '');
  };

  const save = () => {
    const cleaned: SignioLink[] = [];
    for (const r of rows) {
      const url = r.url.trim();
      if (!url) continue; // blank rows are simply dropped
      if (!/^https:\/\//i.test(url)) { toast.error('Links must start with https:// — check "' + (r.label || url) + '"'); return; }
      cleaned.push({ ...r, url, label: r.label.trim() || url });
    }
    if (!cleaned.length) { toast.error('Add at least one link (the Push to Signio button needs one).'); return; }
    const default_id = cleaned.some((l) => l.id === defaultId) ? defaultId : cleaned[0].id;
    update.mutate({ links: cleaned, default_id });
  };

  if (isLoading || !hydrated) {
    return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-emerald-400" />
        <h2 className="text-lg font-semibold">Signio Portal Links</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        The Deal Room's <strong>Push to Signio</strong> button opens the <strong>default</strong> link below.
        Each link declares which <strong>system</strong> its form uses so the ⚡ Fill Signio bookmark fills it the right
        way (the engine also auto-detects the form, so a wrong choice only slows the fill down — it won't break it).
        The bookmark itself never needs re-dragging.
      </p>

      <Card>
        <CardContent className="py-4 space-y-4">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input value={r.label} placeholder="e.g. AA Money portal" onChange={(e) => setRow(i, { label: e.target.value })} />
                </div>
                <div className="w-[210px] space-y-1">
                  <Label className="text-xs">Fill system</Label>
                  <Select value={r.system} onValueChange={(v) => setRow(i, { system: v as SignioSystem })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lightstone">{SYSTEM_LABEL.lightstone}</SelectItem>
                      <SelectItem value="wizard">{SYSTEM_LABEL.wizard}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="radio"
                    id={`signio-default-${r.id}`}
                    name="signio-default"
                    className="h-4 w-4 accent-emerald-500"
                    checked={defaultId === r.id}
                    onChange={() => setDefaultId(r.id)}
                  />
                  <Label htmlFor={`signio-default-${r.id}`} className="text-xs cursor-pointer">Default</Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  title={rows.length <= 1 ? 'At least one link is required' : 'Remove this link'}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link (URL)</Label>
                <Input
                  value={r.url}
                  placeholder="https://…signio.co.za/ThirdPartyIntegration/…"
                  onChange={(e) => setRow(i, { url: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add link
            </Button>
            <Button onClick={save} disabled={update.isPending} className="gap-1.5">
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Known portals: <span className="font-mono">{DEFAULT_SIGNIO_LINKS[0].url.split('?')[0]}</span> (one-page)
        and <span className="font-mono">{DEFAULT_SIGNIO_LINKS[1].url.split('?')[0]}</span> (wizard).
        If Signio issues a new link, paste it here and pick the system that matches how its form looks.
      </p>
    </div>
  );
};

export default SignioLinksTab;
