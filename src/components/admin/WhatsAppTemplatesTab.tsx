import { useState } from 'react';
import { Loader2, MessageCircle, Save, Info, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWhatsAppTemplates, useUpdateWhatsAppTemplate, type WhatsAppTemplate } from '@/hooks/useZtcSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Body-var source options (ZTC's body-var mapping concept). These are curated
// notes describing which field fills each {bodyN} slot — they document intent for
// the team; the live notify-* dispatch fills the vars in code, unaffected by this.
const BODY_SOURCES: { value: string; label: string }[] = [
  { value: 'none', label: 'Not used' },
  { value: 'applicant_full_name', label: 'Applicant full name' },
  { value: 'applicant_first_name', label: 'Applicant first name' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'dealership_name', label: 'Dealership name' },
  { value: 'reference', label: 'Reference / application no.' },
  { value: 'agent_name', label: 'Agent name' },
  { value: 'custom', label: 'Custom / other' },
];

// Normalise a stored source value to a Select-safe value ('' / null → 'none').
const srcVal = (v: string | null | undefined) => (v && v.trim() ? v : 'none');
const srcStore = (v: string) => (v === 'none' ? null : v);

const Row = ({ t }: { t: WhatsAppTemplate }) => {
  const update = useUpdateWhatsAppTemplate();
  const [open, setOpen] = useState(false);

  // Local editable state for the curated fields.
  const [body, setBody] = useState(t.body ?? '');
  const [title, setTitle] = useState(t.title ?? '');
  const [sendUrl, setSendUrl] = useState(t.send_url ?? '');
  const [body1, setBody1] = useState(srcVal(t.body1_source));
  const [body2, setBody2] = useState(srcVal(t.body2_source));
  const [body3, setBody3] = useState(srcVal(t.body3_source));
  const [preview, setPreview] = useState(t.preview_text ?? '');
  const [testing, setTesting] = useState(false);

  const dirty =
    body !== (t.body ?? '') ||
    title !== (t.title ?? '') ||
    sendUrl !== (t.send_url ?? '') ||
    body1 !== srcVal(t.body1_source) ||
    body2 !== srcVal(t.body2_source) ||
    body3 !== srcVal(t.body3_source) ||
    preview !== (t.preview_text ?? '');

  const save = () => {
    update.mutate({
      key: t.key,
      title: title.trim() || t.key,
      body,
      send_url: sendUrl.trim() || null,
      body1_source: srcStore(body1),
      body2_source: srcStore(body2),
      body3_source: srcStore(body3),
      preview_text: preview.trim() || null,
    });
  };

  const testSend = async () => {
    if (!sendUrl.trim()) {
      toast.error('Add an EasySocial send URL first, then save, to test this template.');
      return;
    }
    const phone = window.prompt('Send a test WhatsApp to which number? (e.g. 0821234567)');
    if (phone == null) return; // cancelled
    if (!phone.trim()) { toast.error('A test phone number is required.'); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-test-send', {
        body: {
          send_url: sendUrl.trim(),
          test_phone: phone.trim(),
          // Pass the source labels as sample body values so the test message is legible.
          body1: body1 !== 'none' ? BODY_SOURCES.find((s) => s.value === body1)?.label : undefined,
          body2: body2 !== 'none' ? BODY_SOURCES.find((s) => s.value === body2)?.label : undefined,
          body3: body3 !== 'none' ? BODY_SOURCES.find((s) => s.value === body3)?.label : undefined,
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.ok) toast.success(`Test sent (HTTP ${d.status}).`);
      else toast.error('Test send failed: ' + (d?.detail || d?.error || `HTTP ${d?.status ?? '?'}`));
    } catch (e: any) {
      toast.error('Test send failed: ' + (e?.message || e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left min-w-0">
            {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{title || t.key}</div>
              <div className="text-[11px] text-muted-foreground">key: {t.key}{t.send_url ? '' : ' · no send URL'}</div>
            </div>
          </button>
          <label className="flex items-center gap-2 text-xs shrink-0">
            <span className={t.active ? 'text-emerald-400' : 'text-muted-foreground'}>{t.active ? 'On' : 'Off'}</span>
            <Switch checked={t.active} onCheckedChange={(v) => update.mutate({ key: t.key, active: v })} />
          </label>
        </div>

        {open && (
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs text-muted-foreground">Name / title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-8 text-sm" placeholder="Display name for this notification" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Reference note (what this message says)</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="mt-1 text-sm"
                placeholder="Reference / preview of what this WhatsApp message says…" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">EasySocial send URL</Label>
              <Input value={sendUrl} onChange={(e) => setSendUrl(e.target.value)} className="mt-1 h-8 font-mono text-[11px]"
                placeholder="https://api.easysocial.in/api/v1/wa-templates/send/…/API/{phone}?body1=…" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Optional — needed only for <em>Test send</em>. This URL contains a campaign token, so it is <strong>not</strong> pre-filled.
                Paste the matching send URL from the notify function for this template when you want to test it. Live notifications keep using the built-in URL regardless.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([['Body 1', body1, setBody1], ['Body 2', body2, setBody2], ['Body 3', body3, setBody3]] as const).map(
                ([lbl, val, setVal]) => (
                  <div key={lbl}>
                    <Label className="text-xs text-muted-foreground">{lbl}</Label>
                    <Select value={val} onValueChange={setVal}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BODY_SOURCES.map((s) => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ),
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Preview text</Label>
              <Textarea value={preview} onChange={(e) => setPreview(e.target.value)} rows={2} className="mt-1 text-sm"
                placeholder="How the rendered message reads, with the body vars filled in…" />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={testSend} disabled={testing || !sendUrl.trim()} className="h-7 gap-1">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Test send
              </Button>
              <Button size="sm" onClick={save} disabled={!dirty || update.isPending} className="h-7 gap-1">
                {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save template
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const WhatsAppTemplatesTab = () => {
  const { data: templates = [], isLoading } = useWhatsAppTemplates();
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-emerald-400" />
        <h2 className="text-lg font-semibold">WhatsApp Notifications</h2>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          The message <strong>wording</strong> is a Meta-approved WhatsApp template hosted in EasySocial. Use the toggle to turn each notification on/off
          (takes effect immediately, server-side). Expand a row to curate its name, body-var mapping, and preview, and to paste an EasySocial
          <strong> send URL</strong> for the <em>Test send</em> button. Send URLs contain a campaign token and are never seeded — leave blank unless you want to test.
        </span>
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : templates.map((t) => <Row key={t.key} t={t} />)}
    </div>
  );
};

export default WhatsAppTemplatesTab;
