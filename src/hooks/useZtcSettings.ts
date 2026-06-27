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
export interface StatusOverride {
  slug: string;
  label: string | null;
  color_class: string | null;
  sort_order: number | null;
  is_hidden: boolean;
  whatsapp_message: string | null;
  // ZTC-parity client-track columns (additive; defaults preserve current behaviour).
  status_type: string;             // 'finance' (built-in slugs) | 'client' (admin CRUD)
  comment_required: boolean;       // UI comment gate — enforced in modals only
  comment_prompt: string | null;   // prompt shown above the comment box
  is_internal: boolean;            // store-only flag (not yet wired)
  easysocial_tag_to_add: string | null; // mirrored into integration_settings.config.tag_add_overrides
}

export const useStatusOverrides = () =>
  useQuery({
    queryKey: ['status-overrides'],
    queryFn: async (): Promise<StatusOverride[]> => {
      const { data, error } = await db.from('status_overrides').select('slug, label, color_class, sort_order, is_hidden, whatsapp_message, status_type, comment_required, comment_prompt, is_internal, easysocial_tag_to_add');
      if (error) throw error;
      return data ?? [];
    },
  });

export const useUpsertStatusOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    // The spread passes any new columns through unchanged; widen the param type
    // so callers can set status_type / comment_* / is_internal / easysocial_tag_to_add.
    mutationFn: async (o: Partial<StatusOverride> & { slug: string }) => {
      const { error } = await db.from('status_overrides').upsert({ ...o, updated_at: new Date().toISOString() }, { onConflict: 'slug' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-overrides'] });
      qc.invalidateQueries({ queryKey: ['status-config'] });
      toast.success('Status saved');
    },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

// Delete a status_overrides row. Used ONLY by the client-status editor — finance
// rows are never deletable in the UI (their slugs are wired into the pipeline).
export const useDeleteStatusOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await db.from('status_overrides').delete().eq('slug', slug);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-overrides'] });
      qc.invalidateQueries({ queryKey: ['status-config'] });
      toast.success('Status deleted');
    },
    onError: (e: any) => toast.error('Delete failed: ' + e.message),
  });
};

/* ---------------- Merged status config (defaults + overrides) ----------------
   SLUGS ARE FIXED — overrides only change label/colour/order/visibility, so the
   mailer/notify/pipeline slug contracts are never affected. Consumers (Pipeline v2)
   call labelFor/classFor for the effective presentation. */
export interface MergedStatus { value: string; label: string; colorClass: string; sortOrder: number; hidden: boolean; whatsappMessage: string }

// A client-track status, surfaced for the editor + the client-status <StatusSelect>.
export interface ClientStatus { value: string; label: string; colorClass: string; sortOrder: number; hidden: boolean }

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
      whatsappMessage: ov?.whatsapp_message || '',
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  const labelFor = (slug: string) =>
    byslug.get(slug)?.label || ADMIN_STATUS_LABELS[slug] || slug;
  const classFor = (slug: string) =>
    byslug.get(slug)?.color_class || STATUS_STYLES[slug] || FALLBACK_CLASS;
  // Effective editable WhatsApp body for a slug ('' = use the built-in default).
  const whatsappMessageFor = (slug: string) => byslug.get(slug)?.whatsapp_message || '';

  // Maps for components that take label/style dictionaries.
  const labels: Record<string, string> = {};
  const styles: Record<string, string> = {};
  for (const o of STATUS_OPTIONS as any[]) { labels[o.value] = labelFor(o.value); styles[o.value] = classFor(o.value); }

  /* ---------------- Client status track (admin-defined, free-form) ---------------- */
  // Client rows live in status_overrides with status_type='client'. They are never
  // in STATUS_OPTIONS, so they can't pollute the finance `merged`/labels/styles maps.
  const allClientRows = overrides
    .filter((o) => o.status_type === 'client')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const toClient = (o: StatusOverride): ClientStatus => ({
    value: o.slug,
    label: o.label || o.slug,
    colorClass: o.color_class || FALLBACK_CLASS,
    sortOrder: o.sort_order ?? 0,
    hidden: !!o.is_hidden,
  });
  // Visible client statuses (for dropdowns/badges); allClientStatuses includes hidden (for the editor list).
  const clientStatuses: ClientStatus[] = allClientRows.filter((o) => !o.is_hidden).map(toClient);
  const allClientStatuses: ClientStatus[] = allClientRows.map(toClient);

  // Label/style dictionaries for the client track (mirror labels/styles above).
  const clientLabels: Record<string, string> = {};
  const clientStyles: Record<string, string> = {};
  for (const o of allClientRows) { clientLabels[o.slug] = o.label || o.slug; clientStyles[o.slug] = o.color_class || FALLBACK_CLASS; }

  // Comment-gate resolvers. These work for BOTH tracks since finance + client rows
  // share the `byslug` map (finance slugs are fixed; client slugs are 'client_*').
  const commentRequiredFor = (slug: string) => byslug.get(slug)?.comment_required ?? false;
  const commentPromptFor = (slug: string) => byslug.get(slug)?.comment_prompt ?? '';

  return {
    merged, labelFor, classFor, whatsappMessageFor, labels, styles,
    clientStatuses, allClientStatuses, clientLabels, clientStyles,
    commentRequiredFor, commentPromptFor,
  };
};
