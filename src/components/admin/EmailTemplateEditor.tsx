import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Save, RotateCcw, Eye, Loader2, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { STATUS_OPTIONS, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';

interface EmailTemplate {
  id: string;
  status_key: string;
  subject: string;
  heading: string;
  body_content: string;
  cta_text: string;
  cta_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EmailTemplateEditor = () => {
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState('pending');
  const [editedTemplate, setEditedTemplate] = useState<Partial<EmailTemplate>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch all templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Get current template for active status
  const currentTemplate = templates?.find(t => t.status_key === activeStatus);

  // Update edited template when switching status
  useEffect(() => {
    if (currentTemplate) {
      setEditedTemplate(currentTemplate);
    }
  }, [currentTemplate, activeStatus]);

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate>) => {
      if (!currentTemplate) return;
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: template.subject,
          heading: template.heading,
          body_content: template.body_content,
          cta_text: template.cta_text,
          cta_url: template.cta_url,
          is_active: template.is_active,
        })
        .eq('id', currentTemplate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template saved successfully');
    },
    onError: () => {
      toast.error('Failed to save template');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editedTemplate);
  };

  const handleReset = () => {
    if (currentTemplate) {
      setEditedTemplate(currentTemplate);
      toast.info('Template reset to saved version');
    }
  };

  // Generate preview HTML
  const generatePreview = () => {
    const clientName = 'John Doe';
    const dashboardUrl = 'https://lumina-auto.lovable.app/dashboard';
    const uploadUrl = 'https://lumina-auto.lovable.app/upload-documents/xxx';
    const vehicleName = '2024 BMW 320i M Sport';

    let heading = editedTemplate.heading || '';
    let body = editedTemplate.body_content || '';
    let ctaUrl = editedTemplate.cta_url || dashboardUrl;

    // Replace placeholders
    heading = heading.replace(/\{\{clientName\}\}/g, clientName);
    body = body.replace(/\{\{clientName\}\}/g, clientName);
    body = body.replace(/\{\{vehicleName\}\}/g, vehicleName);
    body = body.replace(/\{\{#if vehicleName\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/gs, '$1');
    ctaUrl = ctaUrl.replace(/\{\{dashboardUrl\}\}/g, dashboardUrl);
    ctaUrl = ctaUrl.replace(/\{\{uploadUrl\}\}/g, uploadUrl);

    // Convert markdown-style to HTML
    body = body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    body = body.replace(/\n/g, '<br>');

    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0;">
          <div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">🚗 Lumina Auto</div>
          <p style="color: #666; margin: 5px 0;">Your Vehicle Finance Journey</p>
        </div>
        <div style="padding: 30px 0;">
          <h2 style="margin: 0 0 20px 0;">${heading}</h2>
          <div style="line-height: 1.6; color: #333;">${body}</div>
          <a href="${ctaUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">
            ${editedTemplate.cta_text || 'Track Your Application'}
          </a>
        </div>
        <div style="text-align: center; padding: 20px 0; border-top: 2px solid #f0f0f0; color: #666; font-size: 12px;">
          <p>Lumina Auto | Premium Vehicle Finance</p>
          <p>Questions? Reply to this email or WhatsApp us at +27 68 601 7462</p>
        </div>
      </div>
    `;
  };

  const statusKeys = STATUS_OPTIONS.map(s => s.value);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Email Template Editor</h2>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Email Preview</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh]">
                  <div 
                    className="bg-white rounded-lg p-4"
                    dangerouslySetInnerHTML={{ __html: generatePreview() }}
                  />
                </ScrollArea>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Template
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Customize the email notifications sent to clients at each stage of their finance journey.
          Use placeholders like <code className="bg-muted px-1 rounded">{'{{clientName}}'}</code>, 
          <code className="bg-muted px-1 rounded">{'{{vehicleName}}'}</code>, 
          <code className="bg-muted px-1 rounded">{'{{dashboardUrl}}'}</code>, and 
          <code className="bg-muted px-1 rounded">{'{{uploadUrl}}'}</code>.
        </p>

        <Tabs value={activeStatus} onValueChange={setActiveStatus}>
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max mb-6">
              {statusKeys.map((status) => {
                const label = ADMIN_STATUS_LABELS[status] || status;
                const template = templates?.find(t => t.status_key === status);
                return (
                  <TabsTrigger
                    key={status}
                    value={status}
                    className="gap-2 whitespace-nowrap"
                  >
                    {template?.is_active && (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                    {label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollArea>

          {statusKeys.map((status) => (
            <TabsContent key={status} value={status} className="space-y-6">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label>Email Active</Label>
                  <p className="text-sm text-muted-foreground">
                    When disabled, no email will be sent for this status
                  </p>
                </div>
                <Switch
                  checked={editedTemplate.is_active ?? true}
                  onCheckedChange={(checked) => 
                    setEditedTemplate(prev => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input
                  value={editedTemplate.subject || ''}
                  onChange={(e) => 
                    setEditedTemplate(prev => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="Enter email subject..."
                />
              </div>

              {/* Heading */}
              <div className="space-y-2">
                <Label>Heading</Label>
                <Input
                  value={editedTemplate.heading || ''}
                  onChange={(e) => 
                    setEditedTemplate(prev => ({ ...prev, heading: e.target.value }))
                  }
                  placeholder="Hi {{clientName}}!"
                />
                <p className="text-xs text-muted-foreground">
                  The main greeting/heading of the email
                </p>
              </div>

              {/* Body Content */}
              <div className="space-y-2">
                <Label>Body Content</Label>
                <Textarea
                  value={editedTemplate.body_content || ''}
                  onChange={(e) => 
                    setEditedTemplate(prev => ({ ...prev, body_content: e.target.value }))
                  }
                  placeholder="Enter the main content of the email..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use **text** for bold, and placeholders for dynamic content
                </p>
              </div>

              {/* CTA Button */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Button Text</Label>
                  <Input
                    value={editedTemplate.cta_text || ''}
                    onChange={(e) => 
                      setEditedTemplate(prev => ({ ...prev, cta_text: e.target.value }))
                    }
                    placeholder="Track Your Application"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Button URL</Label>
                  <Input
                    value={editedTemplate.cta_url || ''}
                    onChange={(e) => 
                      setEditedTemplate(prev => ({ ...prev, cta_url: e.target.value }))
                    }
                    placeholder="{{dashboardUrl}}"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </motion.div>
  );
};

export default EmailTemplateEditor;