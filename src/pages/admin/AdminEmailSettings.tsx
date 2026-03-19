import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Mail, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
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
  validations_pending: 'Validations Pending',
  validations_complete: 'Validations Complete',
  delivered: 'Delivered',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  documents_received: 'Documents Received',
  application_submitted: 'Application Submitted',
};

const AdminEmailSettings = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data, error } = await supabase
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
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  return (
    <AdminLayout>
      <Helmet><title>Email Templates | Lumina Admin</title></Helmet>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Email Automation Templates</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Configure automated messages sent to clients on status changes. Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{clientName}}'}</code> to inject the client's name.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading templates...</p>
        ) : (
          <div className="grid gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className={!tpl.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg capitalize flex items-center gap-2">
                      {STATUS_LABELS[tpl.status_key] || tpl.status_key.replace(/_/g, ' ')}
                      <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                        {tpl.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateField(tpl.id, 'is_active', !tpl.is_active)}
                      >
                        {tpl.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5" />}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(tpl)}
                        disabled={saving === tpl.id}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {saving === tpl.id ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Subject Line</Label>
                    <Input
                      value={tpl.subject}
                      onChange={(e) => updateField(tpl.id, 'subject', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Heading</Label>
                    <Input
                      value={tpl.heading}
                      onChange={(e) => updateField(tpl.id, 'heading', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Body Content</Label>
                    <Textarea
                      rows={4}
                      value={tpl.body_content}
                      onChange={(e) => updateField(tpl.id, 'body_content', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CTA Button Text</Label>
                      <Input
                        value={tpl.cta_text || ''}
                        placeholder="e.g. View Status"
                        onChange={(e) => updateField(tpl.id, 'cta_text', e.target.value || null)}
                      />
                    </div>
                    <div>
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
    </AdminLayout>
  );
};

export default AdminEmailSettings;
