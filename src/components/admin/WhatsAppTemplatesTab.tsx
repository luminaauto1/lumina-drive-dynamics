import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Save, Info, Send, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useWhatsAppTemplates,
  useUpdateWhatsAppTemplate,
  useCreateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  type WhatsAppTemplate,
} from '@/hooks/useZtcSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

// Custom (admin-added) rows carry a `custom_` key prefix. Only these are deletable
// — the built-in auto-notification rows have fixed keys wired into notify-*.
const isCustomKey = (key: string) => key.startsWith('custom_');

// Body-var source options. These are the LIVE mapping: when a status auto-sends
// this template, wa-status-send fills body1/2/3 from whatever is picked here.
// A status may still override any individual slot (status editor → WhatsApp
// auto-send); when it does, the override wins for that status only.
const BODY_SOURCES: { value: string; label: string }[] = [
  { value: 'none', label: 'Not used' },
  { value: 'applicant_full_name', label: 'Applicant full name' },
  { value: 'applicant_first_name', label: 'Applicant first name' },
  { value: 'applicant_mobile', label: 'Applicant mobile number' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'wa_client_info', label: 'WhatsApp To Client Info' },
  { value: 'dealership_name', label: 'Dealership name' },
  { value: 'reference', label: 'Reference / application no.' },
  { value: 'agent_name', label: 'Agent name' },
  { value: 'custom', label: 'Custom / other' },
];

// Normalise a stored source value to a Select-safe value ('' / null → 'none').
// A stored `custom:<text>` collapses to the bare 'custom' select value; the text
// lives alongside it (srcText). Legacy bare 'custom' rows → 'custom' + empty text.
const srcVal = (v: string | null | undefined) => {
  const s = String(v ?? '').trim();
  if (!s) return 'none';
  if (s.startsWith('custom:')) return 'custom';
  return s;
};
// The free-text part of a `custom:<text>` value ('' for every other source).
const srcText = (v: string | null | undefined) => {
  const s = String(v ?? '').trim();
  return s.startsWith('custom:') ? s.slice('custom:'.length) : '';
};
// Re-join a select value + its custom text into the stored form (mirrors
// StatusEditModal's joinBodySource for `static:`). NULL when not used. An empty
// custom text stays the bare 'custom' so legacy rows round-trip untouched.
const srcStore = (v: string, text = '') => {
  if (v === 'none') return null;
  if (v === 'custom') {
    const lit = text.trim();
    return lit ? `custom:${lit}` : 'custom';
  }
  return v;
};

const Row = ({ t }: { t: WhatsAppTemplate }) => {
  const update = useUpdateWhatsAppTemplate();
  const del = useDeleteWhatsAppTemplate();
  const [open, setOpen] = useState(false);

  // Local editable state for the curated fields.
  const [body, setBody] = useState(t.body ?? '');
  const [title, setTitle] = useState(t.title ?? '');
  const [sendUrl, setSendUrl] = useState(t.send_url ?? '');
  const [body1, setBody1] = useState(srcVal(t.body1_source));
  const [body2, setBody2] = useState(srcVal(t.body2_source));
  const [body3, setBody3] = useState(srcVal(t.body3_source));
  // Free text for a slot set to "Custom / other" (stored as `custom:<text>`).
  const [body1Txt, setBody1Txt] = useState(srcText(t.body1_source));
  const [body2Txt, setBody2Txt] = useState(srcText(t.body2_source));
  const [body3Txt, setBody3Txt] = useState(srcText(t.body3_source));
  const [preview, setPreview] = useState(t.preview_text ?? '');
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const custom = isCustomKey(t.key);

  const dirty =
    body !== (t.body ?? '') ||
    title !== (t.title ?? '') ||
    sendUrl !== (t.send_url ?? '') ||
    // Compare the JOINED form so a Custom text edit counts as dirty too.
    srcStore(body1, body1Txt) !== (t.body1_source ?? null) ||
    srcStore(body2, body2Txt) !== (t.body2_source ?? null) ||
    srcStore(body3, body3Txt) !== (t.body3_source ?? null) ||
    preview !== (t.preview_text ?? '');

  const save = () => {
    update.mutate({
      key: t.key,
      title: title.trim() || t.key,
      body,
      send_url: sendUrl.trim() || null,
      body1_source: srcStore(body1, body1Txt),
      body2_source: srcStore(body2, body2Txt),
      body3_source: srcStore(body3, body3Txt),
      preview_text: preview.trim() || null,
    });
  };

  const canTest = !!sendUrl.trim() && !!testPhone.trim();

  // Sample value for Test send: the source's label, or the literal text for Custom.
  const sampleFor = (val: string, text: string) => {
    if (val === 'none') return undefined;
    if (val === 'custom') return text.trim() || BODY_SOURCES.find((s) => s.value === 'custom')?.label;
    return BODY_SOURCES.find((s) => s.value === val)?.label;
  };

  const testSend = async () => {
    if (!sendUrl.trim()) { toast.error('Paste a send URL above to enable Test send.'); return; }
    if (!testPhone.trim()) { toast.error('Enter a test phone number first.'); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-test-send', {
        body: {
          send_url: sendUrl.trim(),
          test_phone: testPhone.trim(),
          // Pass the source labels as sample body values so the test message is legible.
          body1: sampleFor(body1, body1Txt),
          body2: sampleFor(body2, body2Txt),
          body3: sampleFor(body3, body3Txt),
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

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const remove = () => {
    if (!custom) return;
    setConfirmDeleteOpen(true);
  };

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left min-w-0">
            {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{title || t.key}</span>
                {custom && (
                  <span className="shrink-0 rounded-sm border border-amber-500/30 bg-amber-500/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-400">Custom</span>
                )}
              </div>
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
                <strong>This URL drives the LIVE sends.</strong> When EasySocial gives you a new template link, paste it here and every
                automatic notification for this key uses it immediately — no code changes. Keep the <code>?body1=…</code> part exactly as
                EasySocial provides it: it declares which values the template expects (<code>name</code>, <code>mobilenumber</code>).
                An empty URL or an inactive toggle simply turns this notification off.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([
                ['Body 1', body1, setBody1, body1Txt, setBody1Txt],
                ['Body 2', body2, setBody2, body2Txt, setBody2Txt],
                ['Body 3', body3, setBody3, body3Txt, setBody3Txt],
              ] as const).map(([lbl, val, setVal, txt, setTxt]) => (
                <div key={lbl}>
                  <Label className="text-xs text-muted-foreground">{lbl}</Label>
                  <Select value={val} onValueChange={setVal}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BODY_SOURCES.map((s) => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {val === 'custom' && (
                    <Input
                      value={txt}
                      onChange={(e) => (setTxt as (s: string) => void)(e.target.value)}
                      className="mt-1 h-8 text-xs"
                      placeholder="Custom text…"
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-foreground">This is the live mapping.</strong> When a status auto-sends this template, body 1/2/3 are filled from
              the sources picked here. <span className="font-medium text-foreground">Custom / other</span> sends the exact text you type beside it.
              A status can still override an individual body slot in the status editor's <span className="font-medium text-foreground">WhatsApp auto-send</span> section
              — an override wins for that status only; every other status uses what is set here.
            </p>

            <div>
              <Label className="text-xs text-muted-foreground">Preview text</Label>
              <Textarea value={preview} onChange={(e) => setPreview(e.target.value)} rows={2} className="mt-1 text-sm"
                placeholder="How the rendered message reads, with the body vars filled in…" />
            </div>

            {/* Test send — explicit phone box (no more window.prompt). Uses the
                row's send_url + the entered number via the whatsapp-test-send fn. */}
            <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Test phone number</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="h-8 text-sm flex-1"
                  placeholder="e.g. 0821234567"
                  inputMode="tel"
                />
                <Button size="sm" variant="outline" onClick={testSend} disabled={testing || !canTest} className="h-8 gap-1 shrink-0">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Test send
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {!sendUrl.trim()
                  ? 'Paste a send URL above to enable Test send.'
                  : !testPhone.trim()
                    ? 'Enter a test phone number to enable Test send.'
                    : 'Sends one live WhatsApp via this template’s send URL to the number above.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {custom ? (
                <Button size="sm" variant="ghost" onClick={remove} disabled={del.isPending}
                  className="h-7 gap-1 text-red-400 hover:text-red-300">
                  {del.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                </Button>
              ) : <span />}
              <Button size="sm" onClick={save} disabled={!dirty || update.isPending} className="h-7 gap-1">
                {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save template
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete custom template?"
        description={`Delete custom template "${t.title || t.key}"? This can't be undone.`}
        onConfirm={() => { del.mutate(t.key); setConfirmDeleteOpen(false); }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </Card>
  );
};

// Add a custom template by pasting its EasySocial send (API) URL. Custom rows are
// for Test-send + selection only — they get a generated `custom_*` key and are NOT
// auto-fired (the 5 built-in auto-notifications stay wired to their fixed keys).
const AddTemplateForm = () => {
  const create = useCreateWhatsAppTemplate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sendUrl, setSendUrl] = useState('');
  const [preview, setPreview] = useState('');

  const reset = () => { setTitle(''); setSendUrl(''); setPreview(''); setOpen(false); };

  const submit = () => {
    if (!title.trim()) { toast.error('A title is required.'); return; }
    create.mutate(
      { title, send_url: sendUrl || null, preview_text: preview || null },
      { onSuccess: reset },
    );
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8 gap-1">
        <Plus className="w-3.5 h-3.5" /> Add template
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">New custom template</div>
          <Button size="icon" variant="ghost" onClick={reset} className="h-6 w-6"><X className="w-4 h-4" /></Button>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Title <span className="text-red-400">*</span></Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-8 text-sm" placeholder="e.g. Welcome follow-up" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">EasySocial send URL (the API URL)</Label>
          <Input value={sendUrl} onChange={(e) => setSendUrl(e.target.value)} className="mt-1 h-8 font-mono text-[11px]"
            placeholder="https://api.easysocial.in/api/v1/wa-templates/send/…/API/{phone}?body1=…" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Preview text (optional)</Label>
          <Textarea value={preview} onChange={(e) => setPreview(e.target.value)} rows={2} className="mt-1 text-sm"
            placeholder="How the rendered message reads…" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          User-added templates are for <em>Test send</em> + selection (e.g. the status editor’s WhatsApp picker). They get a unique
          <code className="font-mono"> custom_…</code> key and are <strong>not</strong> auto-fired — the 5 built-in auto-notifications stay wired to their fixed keys.
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={reset} className="h-7">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={create.isPending || !title.trim()} className="h-7 gap-1">
            {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Who receives the internal "client pre-approved" WhatsApp (staff numbers, not
// the client). Stored in integration_settings key 'pre_approval_notify' and
// read server-side by notify-pre-approval-internal — save takes effect on the
// very next pre-approval, no deploy needed.
const PreApprovalRecipientsCard = () => {
  const [numbers, setNumbers] = useState<string | null>(null); // null = loading
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from('integration_settings')
      .select('config')
      .eq('key', 'pre_approval_notify')
      .maybeSingle()
      .then(({ data }: any) => {
        const list = Array.isArray(data?.config?.staff_numbers) ? data.config.staff_numbers : [];
        setNumbers(list.join(', '));
      }, () => setNumbers(''));
  }, []);

  const save = async () => {
    const list = (numbers ?? '')
      .split(/[,;\s]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (list.length === 0) { toast.error('Enter at least one number.'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('integration_settings')
        .upsert({
          key: 'pre_approval_notify',
          active: true,
          config: { staff_numbers: list },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      if (error) throw error;
      toast.success(`Pre-approval notify recipients saved (${list.length})`);
    } catch (e: any) {
      toast.error('Failed to save recipients: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="text-sm font-medium">Pre-Approval alert — staff numbers</div>
        <p className="text-[11px] text-muted-foreground">
          These numbers get the internal WhatsApp when a client turns <strong>Pre-Approved</strong>.
          Comma-separated; 0-prefix or 27-prefix both work. Applies immediately.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={numbers ?? ''}
            disabled={numbers === null}
            onChange={(e) => setNumbers(e.target.value)}
            className="h-8 font-mono text-[12px]"
            placeholder="0836117792, 0716196071, 0816783511"
          />
          <Button size="sm" className="h-8 gap-1" onClick={save} disabled={saving || numbers === null}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const WhatsAppTemplatesTab = () => {
  const { data: templates = [], isLoading } = useWhatsAppTemplates();
  return (
    // Width comes from the page shell (SettingsPageLayout).
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-emerald-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</h2>
      </div>
      <PreApprovalRecipientsCard />
      <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          The message <strong>wording</strong> is a Meta-approved WhatsApp template hosted in EasySocial. Use the toggle to turn each notification on/off
          (takes effect immediately, server-side). Expand a row to paste its EasySocial <strong>send URL</strong> and to set its <strong>body 1/2/3 mapping</strong> —
          that mapping is <strong>live</strong>: it decides what each auto-send actually fills in. Send URLs contain a campaign token and are never seeded.
          You can also <strong>add your own</strong> templates (for Test-send + selection); only those are deletable.
        </span>
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : templates.map((t) => <Row key={t.key} t={t} />)}
      <AddTemplateForm />
    </div>
  );
};

export default WhatsAppTemplatesTab;
