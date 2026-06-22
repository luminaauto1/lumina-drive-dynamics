import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { STATUS_OPTIONS, STATUS_STYLES, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';

// New ZTC-parity settings tables aren't in the generated Supabase types yet.
const db = supabase as any;

/* ---------------- EasySocial integration settings ---------------- */
export interface IntegrationSettings { key: string; active: boolean; config: any }

export const useEasySocialSettings = () =>
  useQuery({
    queryKey: ['integration', 'easysocial'],
    queryFn: async (): Promise<IntegrationSettings> => {
      const { data, error } = await db.from('integration_settings').select('key, active, config').eq('key', 'easysocial').maybeSingle();
      if (error) throw error;
      return data ?? { key: 'easysocial', active: true, config: {} };
    },
  });

export const useUpdateEasySocialSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { active?: boolean; config?: any }) => {
      const { error } = await db.from('integration_settings')
        .upsert({ key: 'easysocial', ...patch, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'easysocial'] }); toast.success('EasySocial settings saved'); },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

/* ---------------- WhatsApp notification templates ---------------- */
export interface WhatsAppTemplate { key: string; title: string; body: string; active: boolean }

export const useWhatsAppTemplates = () =>
  useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async (): Promise<WhatsAppTemplate[]> => {
      const { data, error } = await db.from('whatsapp_templates').select('key, title, body, active').order('key');
      if (error) throw error;
      return data ?? [];
    },
  });

export const useUpdateWhatsAppTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<WhatsAppTemplate> & { key: string }) => {
      const { error } = await db.from('whatsapp_templates').update({ ...t, updated_at: new Date().toISOString() }).eq('key', t.key);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template saved'); },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

/* ---------------- Status display overrides ---------------- */
export interface StatusOverride { slug: string; label: string | null; color_class: string | null; sort_order: number | null; is_hidden: boolean }

export const useStatusOverrides = () =>
  useQuery({
    queryKey: ['status-overrides'],
    queryFn: async (): Promise<StatusOverride[]> => {
      const { data, error } = await db.from('status_overrides').select('slug, label, color_class, sort_order, is_hidden');
      if (error) throw error;
      return data ?? [];
    },
  });

export const useUpsertStatusOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: Partial<StatusOverride> & { slug: string }) => {
      const { error } = await db.from('status_overrides').upsert({ ...o, updated_at: new Date().toISOString() }, { onConflict: 'slug' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-overrides'] });
      qc.invalidateQueries({ queryKey: ['status-config'] });
    },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

/* ---------------- Merged status config (defaults + overrides) ----------------
   SLUGS ARE FIXED — overrides only change label/colour/order/visibility, so the
   mailer/notify/pipeline slug contracts are never affected. Consumers (Pipeline v2)
   call labelFor/classFor for the effective presentation. */
export interface MergedStatus { value: string; label: string; colorClass: string; sortOrder: number; hidden: boolean }

export const useStatusConfig = () => {
  const { data: overrides = [] } = useStatusOverrides();
  const byslug = new Map(overrides.map((o) => [o.slug, o]));
  const FALLBACK_CLASS = 'bg-muted text-muted-foreground border-border';

  const merged: MergedStatus[] = STATUS_OPTIONS.map((o: any, i: number) => {
    const ov = byslug.get(o.value);
    return {
      value: o.value,
      label: ov?.label || ADMIN_STATUS_LABELS[o.value] || o.label || o.value,
      colorClass: ov?.color_class || STATUS_STYLES[o.value] || FALLBACK_CLASS,
      sortOrder: ov?.sort_order ?? i,
      hidden: !!ov?.is_hidden,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  const labelFor = (slug: string) =>
    byslug.get(slug)?.label || ADMIN_STATUS_LABELS[slug] || slug;
  const classFor = (slug: string) =>
    byslug.get(slug)?.color_class || STATUS_STYLES[slug] || FALLBACK_CLASS;

  // Maps for components that take label/style dictionaries.
  const labels: Record<string, string> = {};
  const styles: Record<string, string> = {};
  for (const o of STATUS_OPTIONS as any[]) { labels[o.value] = labelFor(o.value); styles[o.value] = classFor(o.value); }

  return { merged, labelFor, classFor, labels, styles };
};
