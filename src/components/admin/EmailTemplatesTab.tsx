import { useState, useEffect } from 'react';
import { Mail, Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  status_key: string;
  subject: string;
  heading: string;
  body_content: string;
  is_active: boolean;
  cta_text: string | null;
  cta_url: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pre_approved: 'Pre-Approved / Deal Structuring',
  approved: 'Approved',
  declined: 'Declined',
  declined_conditional: 'Conditionally Declined',
  validations_pending: 'Validations Pending',
  validations_complete: 'Validations Complete',
  delivered: 'Delivered',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  documents_received: 'Documents Received',
  application_submitted: 'Ready To Load',
};

/** Email automation templates — self-saving (one Save per template), so it lives
 *  safely inside the AdminSettings form. Extracted from the former
 *  /admin/settings/email page (now a redirect into this tab). */
const EmailTemplatesTab = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .order('status_key');
      if (data) setTemplates(data as EmailTemplate[]);
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  const handleSave = async (tpl: EmailTemplate) => {
    setSaving(tpl.id);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: tpl.subject,
          heading: tpl.heading,
          body_content: tpl.body_content,
          is_active: tpl.is_active,
          cta_text: tpl.cta_text,
          cta_url: tpl.cta_url,
        })
        .eq('id', tpl.id);
      if (error) throw error;
      toast.success(`"${STATUS_LABELS[tpl.status_key] || tpl.status_key}" template saved`);
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(null);
    }
  };

  const updateField = (id: string, field: keyof EmailTemplate, value: any) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  return (
    // Width comes from the page shell (SettingsPageLayout).
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground text-sm">
          Configure automated messages sent to clients on status changes. Use{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{clientName}}'}</code> to inject the client's name.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No email templates found.
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className={!tpl.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base capitalize flex flex-wrap items-center gap-2">
                    {STATUS_LABELS[tpl.status_key] || tpl.status_key.replace(/_/g, ' ')}
                    <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                      {tpl.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => updateField(tpl.id, 'is_active', !tpl.is_active)}>
                      {tpl.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5" />}
                    </Button>
                    <Button size="sm" onClick={() => handleSave(tpl)} disabled={saving === tpl.id}>
                      <Save className="h-4 w-4 mr-1" />
                      {saving === tpl.id ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input value={tpl.subject} onChange={(e) => updateField(tpl.id, 'subject', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Heading</Label>
                    <Input value={tpl.heading} onChange={(e) => updateField(tpl.id, 'heading', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Body Content</Label>
                  <Textarea rows={4} value={tpl.body_content} onChange={(e) => updateField(tpl.id, 'body_content', e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>CTA Button Text</Label>
                    <Input
                      value={tpl.cta_text || ''}
                      placeholder="e.g. View Status"
                      onChange={(e) => updateField(tpl.id, 'cta_text', e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA URL</Label>
                    <Input
                      value={tpl.cta_url || ''}
                      placeholder="e.g. {{dashboardUrl}}"
                      onChange={(e) => updateField(tpl.id, 'cta_url', e.target.value || null)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesTab;
