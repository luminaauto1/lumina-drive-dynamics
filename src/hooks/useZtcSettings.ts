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

/* ---------------- Signio portal links ----------------
   The dealership submits finance applications through different Signio portals
   over time (different uuids/hosts), and the two portal FLAVOURS need different
   fill systems: the one-page LIGHTSTONE e-application vs the 7-step wizard.
   Links are managed in Admin → Settings → Signio Links and stored in
   integration_settings under key 'signio' as config: { links: [...], default_id }.
   The fill engine (public/signio-fill.js) auto-detects the form either way — the
   per-link `system` is passed along as a hint so it locks on faster. */
export type SignioSystem = 'lightstone' | 'wizard';
export interface SignioLink {
  id: string;
  label: string;
  url: string;
  system: SignioSystem;
}

// Built-in fallbacks (also what the migration seeds) so Push-to-Signio always has
// a working link even if the settings row is missing or emptied.
export const DEFAULT_SIGNIO_LINKS: SignioLink[] = [
  {
    id: 'lightstone',
    label: 'One-page portal (LIGHTSTONE)',
    url: 'https://thirdparty.signio.co.za/ThirdPartyIntegration/application?skin=LIGHTSTONE&uuid=0000019e-fdf8-8197-9b9e-d86384f9e897',
    system: 'lightstone',
  },
  {
    id: 'wizard',
    label: '7-step wizard portal',
    url: 'https://goa.signio.co.za/ThirdPartyIntegration/?uuid=00000195-23bc-3df6-8b41-6b29efa3f893',
    system: 'wizard',
  },
];

const sanitizeSignioLinks = (raw: any): SignioLink[] =>
  Array.isArray(raw)
    ? raw
        .filter((l: any) => l && typeof l.url === 'string' && l.url.trim() && typeof l.id === 'string')
        .map((l: any) => ({
          id: l.id,
          label: typeof l.label === 'string' && l.label.trim() ? l.label.trim() : l.url,
          url: l.url.trim(),
          system: l.system === 'wizard' ? 'wizard' : 'lightstone',
        }))
    : [];

export const useSignioLinks = () => {
  const q = useQuery({
    queryKey: ['integration', 'signio'],
    queryFn: async (): Promise<IntegrationSettings> => {
      const { data, error } = await db.from('integration_settings').select('key, active, config').eq('key', 'signio').maybeSingle();
      if (error) throw error;
      return data ?? { key: 'signio', active: true, config: {} };
    },
  });
  const stored = sanitizeSignioLinks((q.data?.config as any)?.links);
  const links = stored.length ? stored : DEFAULT_SIGNIO_LINKS;
  const defaultId = (q.data?.config as any)?.default_id;
  const defaultLink = links.find((l) => l.id === defaultId) ?? links[0];
  return { ...q, links, defaultLink };
};

export const useUpdateSignioLinks = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: { links: SignioLink[]; default_id: string | null }) => {
      const { error } = await db.from('integration_settings')
        .upsert({ key: 'signio', active: true, config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'signio'] }); toast.success('Signio links saved'); },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

/* ---------------- WhatsApp notification templates ----------------
   ZTC-parity curated columns (send_url / body*_source / preview_text / sort_order)
   are additive + nullable; defaults preserve current behaviour. They do NOT affect
   notify-* dispatch or the active on/off gate — those still key off key/active. */
export interface WhatsAppTemplate {
  key: string;
  title: string;
  body: string;
  active: boolean;
  // ZTC-parity curated-template fields (additive; may be null/undefined on old rows).
  send_url: string | null;       // EasySocial hosted send URL (the credential) — owner-pasted, NOT seeded.
  body1_source: string | null;   // which source field fills {body1} (curated mapping note).
  body2_source: string | null;
  body3_source: string | null;
  preview_text: string | null;   // rendered preview of the message wording.
  sort_order: number | null;     // editor display order (ascending).
}

export const useWhatsAppTemplates = () =>
  useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async (): Promise<WhatsAppTemplate[]> => {
      const { data, error } = await db
        .from('whatsapp_templates')
        .select('key, title, body, active, send_url, body1_source, body2_source, body3_source, preview_text, sort_order')
        .order('sort_order', { ascending: true })
        .order('key');
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

// Slugify a custom-template title into a stable key fragment (lowercase, _-joined).
const slugifyTemplateTitle = (title: string): string =>
  title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Create an admin-added custom template. The generated key is `custom_<slug>`,
// made unique against the existing keys so it can NEVER collide with (or clobber)
// a built-in auto-notification key. Custom rows are for Test-send + selection only:
// they are NOT wired to any notify-* dispatch (those fire off fixed built-in keys).
export const useCreateWhatsAppTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; send_url?: string | null; preview_text?: string | null }) => {
      const title = input.title.trim();
      if (!title) throw new Error('A title is required.');

      // Read existing rows to (a) pick a collision-free key and (b) sort after them.
      const { data: existing, error: readErr } = await db
        .from('whatsapp_templates')
        .select('key, sort_order');
      if (readErr) throw readErr;
      const rows: { key: string; sort_order: number | null }[] = existing ?? [];
      const keys = new Set(rows.map((r) => r.key));

      const base = 'custom_' + (slugifyTemplateTitle(title) || 'template');
      let key = base;
      let n = 2;
      while (keys.has(key)) key = `${base}_${n++}`;

      const maxSort = rows.reduce((mx, r) => Math.max(mx, r.sort_order ?? 0), 0);

      const { error } = await db.from('whatsapp_templates').insert({
        key,
        title,
        body: '',
        active: true,
        send_url: input.send_url?.trim() ? input.send_url.trim() : null,
        preview_text: input.preview_text?.trim() ? input.preview_text.trim() : null,
        sort_order: maxSort + 1,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return key;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template added'); },
    onError: (e: any) => toast.error('Add failed: ' + e.message),
  });
};

// Delete a template row. The UI gates this to CUSTOM (custom_*) keys only — the
// 5 built-in auto-notification rows are never deletable (their keys are wired into
// the notify-* functions).
export const useDeleteWhatsAppTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await db.from('whatsapp_templates').delete().eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template deleted'); },
    onError: (e: any) => toast.error('Delete failed: ' + e.message),
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
  is_internal: boolean;            // skips config-driven CRM + WhatsApp auto-send (wired in ZTC-parity)
  easysocial_tag_to_add: string | null; // legacy single add NAME, mirrored into integration_settings.config.tag_add_overrides
  easysocial_tags_to_add: string[];      // multi add tag NAMES; when non-empty supersedes the single add in easysocial-tag-sync
  // Editable destination-tab routing (FINANCE only). NULL => fall back to the
  // hardcoded slug→lane map (statusToTab); see src/lib/pipelinev2/tabs.ts.
  lane: string | null;             // chosen PIPELINE_TABS id for this finance slug
  // ── ZTC-parity status-apply config (additive; defaults preserve behaviour) ──
  // Read server-side by easysocial-tag-sync (CRM) + wa-status-send (WhatsApp).
  easysocial_client_status: string | null;   // lead_data.client_status text (NULL => not written)
  tag_remove_mode: string;                    // 'none' | 'specific' | 'all_except'
  easysocial_tags_to_remove: string[];        // tag IDs as text[], interpreted per tag_remove_mode
  whatsapp_template_key: string | null;       // FK-by-convention to whatsapp_templates.key (auto-send)
  wa_body1_source: string | null;             // BodySource for {body1} (full_name|first_name|comment|vehicle|email|phone|bank|static:…|none)
  wa_body2_source: string | null;
  wa_body3_source: string | null;
}

export const useStatusOverrides = () =>
  useQuery({
    queryKey: ['status-overrides'],
    queryFn: async (): Promise<StatusOverride[]> => {
      const { data, error } = await db.from('status_overrides').select('slug, label, color_class, sort_order, is_hidden, whatsapp_message, status_type, comment_required, comment_prompt, is_internal, easysocial_tag_to_add, easysocial_tags_to_add, lane, easysocial_client_status, tag_remove_mode, easysocial_tags_to_remove, whatsapp_template_key, wa_body1_source, wa_body2_source, wa_body3_source');
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

  /* ---------------- Finance destination-tab (lane) overrides ----------------
     Per-finance-slug Pipeline v2 tab routing. Built from rows that are finance
     (status_type='finance' OR legacy rows with no type) AND have a non-null lane.
     Client rows are excluded — they never move pipeline lanes. Empty map =>
     resolveStatusTab falls back to statusToTab everywhere (current behaviour).
     The lane id is validated against PIPELINE_TABS inside resolveStatusTab. */
  const financeLaneOverrides: Record<string, string> = {};
  for (const o of overrides) {
    const isFinance = !o.status_type || o.status_type === 'finance';
    if (isFinance && o.lane) financeLaneOverrides[o.slug] = o.lane;
  }
  // Effective lane resolver for a finance slug (override ?? hardcoded default),
  // for editor defaults / display.
  const laneFor = (slug: string) => financeLaneOverrides[slug];

  return {
    merged, labelFor, classFor, whatsappMessageFor, labels, styles,
    clientStatuses, allClientStatuses, clientLabels, clientStyles,
    commentRequiredFor, commentPromptFor,
    financeLaneOverrides, laneFor,
  };
};
