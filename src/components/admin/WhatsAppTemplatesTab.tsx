import { useState } from 'react';
import { Loader2, MessageCircle, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useWhatsAppTemplates, useUpdateWhatsAppTemplate, type WhatsAppTemplate } from '@/hooks/useZtcSettings';

const Row = ({ t }: { t: WhatsAppTemplate }) => {
  const update = useUpdateWhatsAppTemplate();
  const [body, setBody] = useState(t.body);
  const dirty = body !== t.body;
  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t.title}</div>
            <div className="text-[11px] text-muted-foreground">key: {t.key}</div>
          </div>
          <label className="flex items-center gap-2 text-xs shrink-0">
            <span className={t.active ? 'text-emerald-400' : 'text-muted-foreground'}>{t.active ? 'On' : 'Off'}</span>
            <Switch checked={t.active} onCheckedChange={(v) => update.mutate({ key: t.key, active: v })} />
          </label>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="text-sm"
          placeholder="Reference / preview of what this WhatsApp message says…" />
        {dirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => update.mutate({ key: t.key, body })} disabled={update.isPending} className="h-7 gap-1">
              {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save note
            </Button>
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
        The message <strong>wording</strong> is a Meta-approved WhatsApp template hosted in EasySocial and can't be edited here. Use the toggle to turn each
        notification on/off (takes effect immediately, server-side), and the note field to record what each one says for your team's reference.
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : templates.map((t) => <Row key={t.key} t={t} />)}
    </div>
  );
};

export default WhatsAppTemplatesTab;
