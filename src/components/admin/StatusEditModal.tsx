// Rich ZTC-style status editor (right-side slide-over), used for BOTH the finance
// and client tracks.
//
//  • finance mode — slug is LOCKED (wired into the pipeline/mailer/notify-*). Only
//    presentation + rules (label, colour, visibility, comment gate, internal flag,
//    WhatsApp message, EasySocial tag) are editable.
//  • client mode — full ZTC CRUD: free-form label, generated 'client_*' slug on
//    first save, plus Delete for existing rows.
//
// On save the modal also mirrors the per-status EasySocial tag into
// integration_settings.config.tag_add_overrides (the live integration path that
// EasySocialTab writes), read-modify-write so concurrent edits don't clobber.

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Save, Trash2, Check, ChevronDown, ArrowRight, X, Info } from 'lucide-react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { getStatusDispatchInfo } from '@/lib/statusDispatchInfo';
import {
  useStatusConfig,
  useStatusOverrides,
  useUpsertStatusOverride,
  useDeleteStatusOverride,
  useEasySocialSettings,
  useUpdateEasySocialSettings,
  useWhatsAppTemplates,
} from '@/hooks/useZtcSettings';
import { getWhatsAppMessage, STATUS_OPTIONS } from '@/lib/statusConfig';
import { statusToTab, resolveStatusTab, PIPELINE_TABS } from '@/lib/pipelinev2/tabs';

// Expanded palette (the 7 from the inline StatusesTab editor + 5 more).
const STATUS_COLOR_PRESETS: { label: string; cls: string }[] = [
  { label: 'Slate', cls: 'bg-muted text-muted-foreground border-border' },
  { label: 'Blue', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { label: 'Sky', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  { label: 'Cyan', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { label: 'Teal', cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  { label: 'Green', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { label: 'Amber', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { label: 'Orange', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { label: 'Red', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { label: 'Rose', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { label: 'Pink', cls: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { label: 'Purple', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { label: 'Indigo', cls: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
];

const FALLBACK_CLASS = 'bg-muted text-muted-foreground border-border';

// <datalist> id backing the EasySocial tag combobox (sourced from config.tags_cache,
// the same synced dictionary EasySocialTab autocompletes its override fields from).
const TAG_DATALIST_ID = 'easysocial-tag-cache-statusedit';

// Finance slugs whose client WhatsApp notification is ALREADY owned by a built-in
// notify-* auto-send. Per-status auto-send is DISABLED for these (no double-send) —
// the dispatch hook + wa-status-send both exclude them; this drives the editor's
// amber warning banner + disabled template picker. Kept in sync with both.
const NOTIFY_OWNED_STATUSES = new Set<string>([
  'application_submitted',
  'ready_to_submit',
  'declined',
  'blacklisted',
  'client_cancelled',
  'pre_approved',
]);

// WhatsApp BodySource options (ZTC parity). 'static:' reveals a literal text input.
const BODY_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Not used' },
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'comment', label: 'Status comment' },
  { value: 'wa_client_info', label: 'WhatsApp To Client Info' },
  { value: 'vehicle', label: 'Vehicle (year make model)' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'bank', label: 'Bank name' },
  { value: 'static', label: 'Static text…' },
];

// Sentinel value for the "no template" option in the auto-send picker (Radix
// Select forbids an empty-string item value).
const NO_TEMPLATE = '__none__';
// Sentinel for a CLIENT status that must not move the lead between pipeline tabs
// (Radix Select forbids an empty-string item value, so the "stay put" choice
// needs a real value; it is stored as NULL in status_overrides.lane).
const NO_LANE = '__stay__';

// Split a stored body-source ("static:Foo" | "first_name" | null) into the select
// value (the kind) + the static literal (only meaningful when kind === 'static').
const splitBodySource = (raw: string | null | undefined): { kind: string; literal: string } => {
  const s = String(raw ?? '').trim();
  if (!s || s === 'none') return { kind: 'none', literal: '' };
  if (s.startsWith('static:')) return { kind: 'static', literal: s.slice('static:'.length) };
  return { kind: s, literal: '' };
};

// Re-join a select-value + literal back into the stored form. NULL when not used.
const joinBodySource = (kind: string, literal: string): string | null => {
  if (!kind || kind === 'none') return null;
  if (kind === 'static') {
    const lit = literal.trim();
    return lit ? `static:${lit}` : null;
  }
  return kind;
};

const slugifyClientLabel = (label: string): string =>
  'client_' + label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// One labelled row in the read-only "Built-in behaviour" panel. A dash (—) reads
// as "nothing fires" for that channel; a value is emphasised in the foreground.
function DispatchRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={value ? 'text-foreground' : 'text-muted-foreground/60'}>{value ?? '—'}</dd>
    </div>
  );
}

export function StatusEditModal({
  initialMode,
  slug,
  onClose,
}: {
  /** Initial status track. State-ified below: a radio reflects/sets it on CREATE
   *  (Client proceeds; Finance is built-in/inert) and is DISABLED on EDIT — an
   *  existing row's track can't be flipped (it would orphan a wired finance slug
   *  or inject a non-built-in slug into the finance pipeline). */
  initialMode: 'finance' | 'client';
  /** Existing row to edit. Absent in client CREATE mode. */
  slug?: string;
  onClose: () => void;
}) {
  const { data: overrides = [] } = useStatusOverrides();
  const { allClientStatuses, labelFor, classFor } = useStatusConfig();
  const upsert = useUpsertStatusOverride();
  const del = useDeleteStatusOverride();
  const { data: easySocial } = useEasySocialSettings();
  const updateEasySocial = useUpdateEasySocialSettings();
  const { data: waTemplates = [] } = useWhatsAppTemplates();

  // Status-type radio: defaulted from initialMode, editable only on CREATE, and
  // disabled on EDIT (slug present). Finance is built-in/fixed in Lumina, so the
  // Finance option is inert (shown for parity, but only Client can be saved here).
  const [type, setType] = useState<'finance' | 'client'>(initialMode);
  const isEdit = !!slug;

  // Synced EasySocial tag dictionary (name → id) populated by easysocial-list-tags,
  // read from config.tags_cache — the same source EasySocialTab uses for its pickers.
  // Backward-safe: when empty, the tag field below stays plain free-text.
  const cachedTags: { name: string; id: number }[] = useMemo(() => {
    const raw = (easySocial?.config as any)?.tags_cache;
    return Array.isArray(raw)
      ? raw.filter((t: any) => t && typeof t.name === 'string')
      : [];
  }, [easySocial]);

  // id (as string) → name, for rendering the remove/keep multi-select chips and the
  // ZTC-parity "tag to add" resolved-id hint. Falls back to the raw id when unknown.
  const tagNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of cachedTags) m.set(String(t.id), t.name);
    return m;
  }, [cachedTags]);
  const tagLabelForId = (id: string) => tagNameById.get(id) ?? `#${id}`;

  const existing = useMemo(() => overrides.find((o) => o.slug === slug), [overrides, slug]);
  const isClientCreate = type === 'client' && !slug;
  // On CREATE, selecting Finance is inert (built-in slugs aren't row-created here).
  const isFinanceCreateBlocked = !isEdit && type === 'finance';

  // Pre-fill from the EFFECTIVE current value (override ?? built-in) so editing a
  // built-in status (e.g. Pending) shows its real name/colour instead of a blank
  // field — and so a no-op Save can't wipe the label or reset the colour to Slate.
  // labelFor/classFor resolve both tracks (finance built-ins + client override rows).
  const [label, setLabel] = useState(slug ? labelFor(slug) : '');
  const [cls, setCls] = useState(slug ? classFor(slug) : FALLBACK_CLASS);
  const [hidden, setHidden] = useState(!!existing?.is_hidden);
  const [commentRequired, setCommentRequired] = useState(!!existing?.comment_required);
  const [commentPrompt, setCommentPrompt] = useState(existing?.comment_prompt ?? '');
  // WhatsApp To Client Info — a dedicated per-status message box (distinct from the
  // comment gate). When enabled, the status-change UIs show it on apply; the text is
  // logged as a note AND available as the wa_client_info WhatsApp body source.
  const [waClientInfoEnabled, setWaClientInfoEnabled] = useState(!!existing?.wa_client_info_enabled);
  const [waClientInfoRequired, setWaClientInfoRequired] = useState(!!existing?.wa_client_info_required);
  const [waClientInfoPrompt, setWaClientInfoPrompt] = useState(existing?.wa_client_info_prompt ?? '');
  // Per-status SLA in hours (finance track). Empty = built-in default from
  // lib/finance/sla.ts; drives the Finance page's Age chips + Stalled queue.
  const [slaHours, setSlaHours] = useState<string>(
    existing?.sla_hours != null ? String(existing.sla_hours) : '',
  );
  const [isInternal, setIsInternal] = useState(!!existing?.is_internal);
  // CLIENT track: clear this status off every application at midnight SAST.
  // Day-to-day working statuses (No Answer, Actioned) reset; milestones
  // (Validations Submitted, Contract Signed) must persist. Default OFF.
  const [resetsDaily, setResetsDaily] = useState(!!existing?.resets_daily);
  const [waMessage, setWaMessage] = useState(existing?.whatsapp_message ?? '');
  const [tag, setTag] = useState(existing?.easysocial_tag_to_add ?? '');
  // Multi tag-to-ADD (NAMES). When non-empty this is what the edge fn ADDs ALL of,
  // superseding the single `tag` override; empty => exactly today's single-tag path.
  // Seeded from the row's easysocial_tags_to_add, else the single tag (back-compat)
  // so an existing single-tag status opens with that tag already selected.
  const [tagsToAdd, setTagsToAdd] = useState<string[]>(() => {
    const multi = Array.isArray(existing?.easysocial_tags_to_add)
      ? (existing!.easysocial_tags_to_add as string[]).map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (multi.length > 0) return Array.from(new Set(multi));
    const single = (existing?.easysocial_tag_to_add ?? '').trim();
    return single ? [single] : [];
  });
  // Free-text entry for adding a custom tag name (used when the cache is empty or
  // the wanted tag isn't synced yet).
  const [customTag, setCustomTag] = useState('');
  // FINANCE destination tab (lane). Defaults to the resolved tab: a saved lane
  // override if present, else the hardcoded statusToTab default. Editing this only
  // changes which Pipeline v2 tab the app is shown/counted in — never the status
  // value, dispatch or slugs.
  // CLIENT statuses may now ALSO route (owner 2026-07-20): "Wrong Info" can move
  // the lead to the Wrong Info tab while "Actioned" leaves it where it is. Their
  // neutral value is NO_LANE (stay put) rather than a built-in destination.
  const [lane, setLane] = useState<string>(() => {
    if (type === 'client') return existing?.lane || NO_LANE;
    return slug ? resolveStatusTab(slug, existing?.lane ? { [slug]: existing.lane } : undefined) : 'intake';
  });
  const [tagSeeded, setTagSeeded] = useState(false);
  const [error, setError] = useState('');

  // ── ZTC-parity status-apply config (FINANCE only) ──────────────────────────
  // EasySocial CRM: client_status text + tag remove-mode + remove/keep tag id list.
  const [esClientStatus, setEsClientStatus] = useState(existing?.easysocial_client_status ?? '');
  const [tagRemoveMode, setTagRemoveMode] = useState<'none' | 'specific' | 'all_except'>(
    (existing?.tag_remove_mode as any) === 'specific' || (existing?.tag_remove_mode as any) === 'all_except'
      ? (existing!.tag_remove_mode as any)
      : 'none',
  );
  // Remove/keep list stored as tag IDs (text[]); held here as a string[] of ids.
  const [tagsToRemove, setTagsToRemove] = useState<string[]>(
    Array.isArray(existing?.easysocial_tags_to_remove) ? (existing!.easysocial_tags_to_remove as string[]) : [],
  );
  // WhatsApp auto-send: curated template link + body1/2/3 sources.
  const [waTemplateKey, setWaTemplateKey] = useState<string>(existing?.whatsapp_template_key ?? '');
  const b1 = splitBodySource(existing?.wa_body1_source);
  const b2 = splitBodySource(existing?.wa_body2_source);
  const b3 = splitBodySource(existing?.wa_body3_source);
  const [waBody1Kind, setWaBody1Kind] = useState(b1.kind);
  const [waBody1Static, setWaBody1Static] = useState(b1.literal);
  const [waBody2Kind, setWaBody2Kind] = useState(b2.kind);
  const [waBody2Static, setWaBody2Static] = useState(b2.literal);
  const [waBody3Kind, setWaBody3Kind] = useState(b3.kind);
  const [waBody3Static, setWaBody3Static] = useState(b3.literal);

  // This finance slug already has a built-in notify-* auto-send → block per-status
  // auto-send (no double messaging). Drives the amber banner + disabled picker.
  const isNotifyOwned = type === 'finance' && !!slug && NOTIFY_OWNED_STATUSES.has(slug);

  // Seed the "tag to add" field from the canonical store so a no-op save is a true
  // no-op. The override COLUMN is preferred, but it's a dual source of truth with
  // integration_settings.config.tag_add_overrides (what EasySocialTab reads/writes).
  // If an admin set the tag via EasySocialTab the column is null, so fall back to the
  // live override here — otherwise opening + saving would run delete tagOverrides[slug]
  // and silently wipe it. easySocial loads async, so seed once when data arrives.
  useEffect(() => {
    if (tagSeeded || !slug) return;
    if ((existing?.easysocial_tag_to_add ?? '') === '' && easySocial) {
      const fallback = (easySocial.config as any)?.tag_add_overrides?.[slug];
      if (typeof fallback === 'string' && fallback) {
        setTag(fallback);
        // Mirror into the multi-list ONLY if it's still empty (don't clobber a
        // row that already configured easysocial_tags_to_add), so opening + saving
        // an EasySocialTab-set single tag doesn't silently drop it.
        setTagsToAdd((cur) => (cur.length > 0 ? cur : [fallback]));
      }
      setTagSeeded(true);
    } else if (existing?.easysocial_tag_to_add) {
      setTagSeeded(true);
    }
  }, [tagSeeded, slug, existing?.easysocial_tag_to_add, easySocial]);

  // Effective slug for previews / writes.
  const effectiveSlug = type === 'finance' ? (slug ?? '') : (slug ?? slugifyClientLabel(label));
  const previewClass = cls || FALLBACK_CLASS;
  const previewLabel = label || effectiveSlug || 'Preview';
  const builtInWaPreview = type === 'finance' && slug ? getWhatsAppMessage(slug, '{name}') : '';

  // Read-only "what fires" descriptor for the edited FINANCE status (hand-maintained
  // in statusDispatchInfo.ts, kept in sync with the real dispatch + planForStatus).
  const dispatchInfo = type === 'finance' && slug ? getStatusDispatchInfo(slug) : null;
  const esRemoveText = dispatchInfo
    ? dispatchInfo.esRemove === 'MASTER_WIPE'
      ? 'Wipes all pipeline tags'
      : dispatchInfo.esRemove.length > 0
        ? dispatchInfo.esRemove.join(', ')
        : undefined
    : undefined;
  const esAddText =
    dispatchInfo && dispatchInfo.esAdd.length > 0 ? dispatchInfo.esAdd.join(', ') : undefined;
  // True when NOTHING built-in fires for this status (no WhatsApp, no email, no tags).
  const firesNothing =
    !!dispatchInfo &&
    !dispatchInfo.clientWhatsapp &&
    !dispatchInfo.staffWhatsapp &&
    !dispatchInfo.email &&
    !esAddText &&
    !esRemoveText;

  // ZTC-parity: resolve a tag NAME → its EasySocial integer id (from the synced
  // cache) to show beside the name. '' when unknown/empty. Used for the add chips.
  const idForTagName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of cachedTags) m.set(t.name, String(t.id));
    return (name: string) => m.get(name) ?? '';
  }, [cachedTags]);

  // Toggle a tag id in the remove/keep multi-select.
  const toggleRemoveTag = (id: string) =>
    setTagsToRemove((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // ── Multi tag-to-ADD helpers (NAMES) ───────────────────────────────────────
  // Toggle a synced tag NAME in the add multi-select.
  const toggleAddTag = (name: string) =>
    setTagsToAdd((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const removeAddTag = (name: string) =>
    setTagsToAdd((cur) => cur.filter((x) => x !== name));
  // Commit the free-text custom tag input as a chip (de-duped, trimmed).
  const addCustomTag = () => {
    const v = customTag.trim();
    if (!v) return;
    setTagsToAdd((cur) => (cur.includes(v) ? cur : [...cur, v]));
    setCustomTag('');
  };

  // The hardcoded default lane for this FINANCE slug (shown as the "(default)"
  // hint in the dropdown so the owner can see what empty would route to).
  const defaultLaneKey = useMemo(() => (slug ? statusToTab(slug) : 'intake'), [slug]);
  const defaultLaneLabel = useMemo(
    () => PIPELINE_TABS.find((t) => t.key === defaultLaneKey)?.label ?? '',
    [defaultLaneKey],
  );

  const titleText = type === 'finance'
    ? (isEdit ? 'Edit finance status' : 'Add status')
    : isClientCreate ? 'Add client status' : 'Edit client status';

  const save = async () => {
    setError('');
    // Finance statuses are built-in/fixed and aren't created from this editor.
    if (isFinanceCreateBlocked) {
      setError('Finance statuses are built-in — edit them from the list above.');
      return;
    }
    if (!label.trim()) { setError('Label is required.'); return; }
    if (commentRequired && !commentPrompt.trim()) {
      setError('When you require a comment, give a prompt the user sees.');
      return;
    }

    let writeSlug = effectiveSlug;
    let sortOrder = existing?.sort_order ?? 0;

    if (type === 'client') {
      if (isClientCreate) {
        writeSlug = slugifyClientLabel(label);
        if (!writeSlug || writeSlug === 'client_') { setError('Enter a label with at least one letter or number.'); return; }
        // Collision check against existing client slugs.
        if (allClientStatuses.some((c) => c.value === writeSlug)) {
          setError('A client status with that name already exists.');
          return;
        }
        // Guard against colliding with a fixed FINANCE slug. The 'client_' prefix
        // makes this rare, but a finance slug already starts with it
        // (client_cancelled), so e.g. a label of "Cancelled" would slugify into it
        // and the onConflict:'slug' upsert would clobber the finance row.
        if (STATUS_OPTIONS.some((o: { value: string }) => o.value === writeSlug)) {
          setError('That name conflicts with a built-in finance status. Pick a different label.');
          return;
        }
        sortOrder = allClientStatuses.reduce((mx, c) => Math.max(mx, c.sortOrder), 0) + 1;
      }
    }

    // Multi tag-to-ADD NAMES (trimmed, de-duped, order-preserving). When non-empty
    // the edge fn ADDs ALL of these (superseding the single add); empty => the
    // single-tag / hardcoded-plan fallback (exactly today's behaviour).
    const cleanTagsToAdd = Array.from(
      new Set(tagsToAdd.map((t) => t.trim()).filter(Boolean)),
    );
    // Legacy single add NAME kept in sync for back-compat (first selected): the
    // edge fn prefers the multi list when present, but EasySocialTab + older reads
    // still consult the single column / the tag_add_overrides mirror.
    const legacySingleTag = cleanTagsToAdd[0] ?? '';

    try {
      await upsert.mutateAsync({
        slug: writeSlug,
        label: label.trim(),
        color_class: cls,
        sort_order: sortOrder,
        is_hidden: hidden,
        // Empty => NULL so the built-in default is used (current behaviour preserved).
        whatsapp_message: waMessage.trim() ? waMessage : null,
        comment_required: commentRequired,
        comment_prompt: commentPrompt.trim() ? commentPrompt.trim() : null,
        // WhatsApp To Client Info — dedicated per-status message box. When disabled,
        // required is forced off + the prompt cleared so a no-op status is inert.
        wa_client_info_enabled: waClientInfoEnabled,
        wa_client_info_required: waClientInfoEnabled ? waClientInfoRequired : false,
        wa_client_info_prompt:
          waClientInfoEnabled && waClientInfoPrompt.trim() ? waClientInfoPrompt.trim() : null,
        // Empty / invalid => NULL so the built-in SLA default applies (finance only).
        sla_hours: type === 'finance' && Number(slaHours) > 0 ? Math.round(Number(slaHours)) : null,
        is_internal: isInternal,
        // Client track only — a finance status is never touched by the reset job.
        resets_daily: type === 'client' ? resetsDaily : false,
        easysocial_tag_to_add: legacySingleTag ? legacySingleTag : null,
        easysocial_tags_to_add: cleanTagsToAdd,
        status_type: type,
        // Destination-tab routing — BOTH tracks, but with different neutral values,
        // so the neutral choice always stores NULL (empty override = fully reversible).
        // FINANCE: picking the built-in destination clears the override.
        // CLIENT: no built-in destination exists — NO_LANE ("stay in the current
        // tab") is the neutral choice, so anything else is a real override.
        lane: type === 'client'
          ? (lane && lane !== NO_LANE ? lane : null)
          : (type === 'finance' && lane && lane !== defaultLaneKey ? lane : null),
        // ── ZTC-parity status-apply config — BOTH tracks since 2026-07-14:
        //    client-status applies now run the tag sync too (config-driven).
        //    Empty => NULL / 'none' / [] so an unconfigured status behaves as today. ──
        easysocial_client_status: esClientStatus.trim() ? esClientStatus.trim() : null,
        tag_remove_mode: tagRemoveMode,
        easysocial_tags_to_remove: tagRemoveMode !== 'none' ? tagsToRemove : [],
        // Auto-send link — persisted for BOTH tracks (finance + opt-in client
        // auto-send). Suppressed only for notify-* owned finance slugs (no
        // double-send); isNotifyOwned is never true for client statuses.
        whatsapp_template_key:
          !isNotifyOwned && waTemplateKey ? waTemplateKey : null,
        wa_body1_source:
          !isNotifyOwned ? joinBodySource(waBody1Kind, waBody1Static) : null,
        wa_body2_source:
          !isNotifyOwned ? joinBodySource(waBody2Kind, waBody2Static) : null,
        wa_body3_source:
          !isNotifyOwned ? joinBodySource(waBody3Kind, waBody3Static) : null,
      });

      // Mirror the EasySocial tag into the live integration path (read-modify-write).
      // The mirror stays a SINGLE name (the live integration map is {slug: name});
      // use the first selected tag so EasySocialTab + the single-override fallback
      // stay coherent. The multi list lives only in the status_overrides column.
      const tagOverrides: Record<string, string> = { ...((easySocial?.config?.tag_add_overrides as Record<string, string>) ?? {}) };
      if (legacySingleTag) tagOverrides[writeSlug] = legacySingleTag;
      else delete tagOverrides[writeSlug];
      const config = { ...(easySocial?.config ?? {}), tag_add_overrides: tagOverrides };
      await updateEasySocial.mutateAsync({ config });

      onClose();
    } catch {
      /* hooks toast their own errors */
    }
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const remove = async () => {
    if (!slug || type !== 'client') return;
    try {
      await del.mutateAsync(slug);
      onClose();
    } catch { /* hook toasts */ }
  };

  const pending = upsert.isPending || updateEasySocial.isPending;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titleText}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Status TYPE radio — reflects/sets the track. Editable on CREATE only;
              disabled on EDIT (a row's track can't be flipped). */}
          <div className="space-y-1.5">
            <Label className="text-sm">Status type</Label>
            <div className="flex flex-wrap gap-2">
              {(['client', 'finance'] as const).map((t) => {
                const selected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isEdit}
                    onClick={() => { if (!isEdit) { setType(t); setError(''); } }}
                    className={
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition ' +
                      (selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground') +
                      (isEdit ? ' opacity-60 cursor-not-allowed' : '')
                    }
                  >
                    {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                    {t === 'client' ? 'Client status' : 'Finance status'}
                  </button>
                );
              })}
            </div>
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">A status's type is fixed after creation and can't be changed here.</p>
            )}
            {isFinanceCreateBlocked && (
              <p className="text-[11px] text-amber-400">Finance statuses are built-in — edit them from the list above.</p>
            )}
          </div>

          {/* Status type (read-only context) */}
          <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            {type === 'finance' ? (
              slug
                ? <>Finance — fixed slug (<code className="font-mono text-foreground/80">{slug}</code>), presentation + rules editable.</>
                : <>Finance statuses are built-in (wired into the pipeline, mailer and notifications) and can't be created here — edit them from the list above.</>
            ) : (
              <>Client status — free-form. {slug ? <>Slug <code className="font-mono text-foreground/80">{slug}</code>.</> : 'A slug is generated from the label on save.'}</>
            )}
          </div>

          {/* Built-in behaviour (READ-ONLY — FINANCE only). Shows precisely what
              Lumina auto-fires when an application enters this status: dedicated
              client/staff WhatsApp, the auto-email template, and the EasySocial
              tag plan. Sourced from statusDispatchInfo.ts (hand-maintained in sync
              with the dispatch hook + easysocial planForStatus). Not editable here. */}
          {type === 'finance' && slug && (
            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Built-in behaviour (not editable here)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                What Lumina automatically fires when an application enters this status. These are wired into the app and edge functions — they can't be changed from this editor.
              </p>
              {dispatchInfo ? (
                <>
                  <dl className="space-y-1.5 text-xs">
                    <DispatchRow label="Client WhatsApp" value={dispatchInfo.clientWhatsapp} />
                    <DispatchRow label="Staff WhatsApp" value={dispatchInfo.staffWhatsapp} />
                    <DispatchRow label="Auto-email" value={dispatchInfo.email} />
                    <DispatchRow label="EasySocial — tags added" value={esAddText} />
                    <DispatchRow label="EasySocial — tags removed" value={esRemoveText} />
                  </dl>
                  {firesNothing && (
                    <p className="text-[11px] font-medium text-foreground">
                      {slug === 'application_submitted'
                        ? 'This status fires nothing — "Ready To Load" (credit-check passed) is a silent internal marker: no client message, no email, no tag change.'
                        : 'This status fires no built-in notifications.'}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No documented built-in dispatch for this status.</p>
              )}
            </div>
          )}

          {/* Destination pipeline tab (EDITABLE — FINANCE only). Picks which
              Pipeline v2 lane an application is shown/counted in when it has this
              status. Default = the resolved tab (saved override ?? hardcoded
              statusToTab default). Choosing the default stores NULL => identical
              to current behaviour, fully reversible. This ONLY changes bucketing —
              never the status value, dispatch, slugs, or the client track. */}
          {type === 'finance' && slug && (
            <div className="space-y-1.5">
              <Label className="text-sm">Moves the application to</Label>
              <div className="flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={lane} onValueChange={setLane}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pipeline tab" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 'all' is a view-all pseudo-tab, never a routing destination
                        (an app routed there would match no real lane and vanish
                        from every working tab + count) — so it's excluded here. */}
                    {PIPELINE_TABS.filter((t) => t.key !== 'all').map((t) => (
                      <SelectItem key={t.key} value={t.key} className="text-sm">
                        {t.label}{t.key === defaultLaneKey ? ' (default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When this status is set on an application, it appears (and counts) in this pipeline tab. Reversible — pick
                <span className="font-medium text-foreground"> {defaultLaneLabel || 'the default'} (default)</span> to restore the built-in routing.
              </p>
            </div>
          )}
          {/* Client statuses may optionally route to a pipeline tab. Default is
              NO_LANE = stay put, which is how every existing client status behaves. */}
          {type === 'client' && (
            <div className="space-y-1.5">
              <Label className="text-sm">Moves the lead to</Label>
              <div className="flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={lane} onValueChange={setLane}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Stay in the current tab" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LANE} className="text-sm">Stay in the current tab</SelectItem>
                    {PIPELINE_TABS.filter((t) => t.key !== 'all').map((t) => (
                      <SelectItem key={t.key} value={t.key} className="text-sm">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {lane && lane !== NO_LANE
                  ? 'Setting this client status moves the lead into that tab (and its count), overriding where its finance status would put it. Clearing the client status returns it to the finance tab.'
                  : 'Setting this client status leaves the lead where its finance status puts it — the badge changes, the tab does not.'}
              </p>
            </div>
          )}

          {/* Overnight reset (client track only). The `client-status-daily-reset`
              cron job clears ONLY the statuses flagged here, at midnight SAST —
              so working statuses start each day clean while milestones persist. */}
          {type === 'client' && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="resetsDaily" checked={resetsDaily} onCheckedChange={(v) => setResetsDaily(!!v)} />
                <Label htmlFor="resetsDaily" className="text-sm font-normal">
                  Clear this status overnight (resets the next day)
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {resetsDaily
                  ? 'Applications with this status are cleared at midnight, so the list starts fresh each day. Use it for day-to-day working statuses like No Answer or Actioned — the note history is kept.'
                  : 'This status stays on the application until someone changes it. Use this for milestones like Validations Submitted or Contract Signed.'}
              </p>
            </div>
          )}

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-sm">Label <span className="text-red-400">*</span></Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Display label" />
            {isClientCreate && label.trim() && (
              <p className="text-[11px] text-muted-foreground">Slug: <code className="font-mono">{slugifyClientLabel(label) || 'client_'}</code></p>
            )}
          </div>

          {/* Badge colour */}
          <div className="space-y-1.5">
            <Label className="text-sm">Badge colour</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_COLOR_PRESETS.map((p) => (
                <button
                  key={p.cls}
                  type="button"
                  onClick={() => setCls(p.cls)}
                  title={p.label}
                  className={
                    'relative inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ' +
                    p.cls +
                    (cls === p.cls ? ' ring-2 ring-primary ring-offset-1 ring-offset-background' : '')
                  }
                >
                  {cls === p.cls && <Check className="h-3 w-3" />}
                  {p.label}
                </button>
              ))}
            </div>
            <div className="pt-1">
              <span className="text-[11px] text-muted-foreground">Preview: </span>
              <span className={'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold ' + previewClass}>
                {previewLabel}
              </span>
            </div>
          </div>

          {/* Visible toggle */}
          <div className="flex items-center gap-2">
            <Checkbox id="visible" checked={!hidden} onCheckedChange={(v) => setHidden(!v)} />
            <Label htmlFor="visible" className="text-sm font-normal">Visible (uncheck to hide this status everywhere)</Label>
          </div>

          {/* Comment behaviour */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="commentReq" checked={commentRequired} onCheckedChange={(v) => setCommentRequired(!!v)} />
              <Label htmlFor="commentReq" className="text-sm font-normal">Require a comment before saving this status</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Prompt shown above the comment box</Label>
              <Input value={commentPrompt} onChange={(e) => setCommentPrompt(e.target.value)} placeholder="e.g. Why are you setting this status?" className="h-8 text-sm" />
            </div>
          </div>

          {/* WhatsApp To Client Info — a dedicated per-status message box (separate
              from the comment gate). Shown for BOTH tracks (per-status behaviour,
              like the comment gate). When enabled, the status-change UIs prompt for
              this text on apply; it is logged as a note AND can be injected into a
              WhatsApp template via the 'WhatsApp To Client Info' Body option. */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="waClientInfo" checked={waClientInfoEnabled} onCheckedChange={(v) => setWaClientInfoEnabled(!!v)} />
              <Label htmlFor="waClientInfo" className="text-sm font-normal">Ask for a WhatsApp To Client Info message when this status is set</Label>
            </div>
            {waClientInfoEnabled && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox id="waClientInfoReq" checked={waClientInfoRequired} onCheckedChange={(v) => setWaClientInfoRequired(!!v)} />
                  <Label htmlFor="waClientInfoReq" className="text-sm font-normal">Require this message before the status can be saved</Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prompt shown above the box (optional)</Label>
                  <Input value={waClientInfoPrompt} onChange={(e) => setWaClientInfoPrompt(e.target.value)} placeholder="e.g. Message to send the client on WhatsApp" className="h-8 text-sm" />
                </div>
              </>
            )}
            <p className="text-[11px] text-muted-foreground">
              This message can be injected into a WhatsApp template via the <span className="font-medium text-foreground">WhatsApp To Client Info</span> Body option.
            </p>
          </div>

          {/* SLA (finance track): how long an app may sit in this status before
              it reads as STALLED on the Finance page (Age chip turns red +
              lands in the ⚠ Stalled queue/tile). */}
          {type === 'finance' && (
            <div className="space-y-1.5 rounded-md border border-border p-3">
              <Label className="text-xs text-muted-foreground">SLA — hours before an application in this status counts as stalled</Label>
              <Input
                type="number"
                min={0}
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="Empty = built-in default (e.g. Sent to Banks 72h)"
                className="h-8 text-sm w-56"
              />
            </div>
          )}

          {/* Internal only (store-only) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox id="internal" checked={isInternal} onCheckedChange={(v) => setIsInternal(!!v)} />
              <Label htmlFor="internal" className="text-sm font-normal">Internal only</Label>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">Skips the config-driven EasySocial CRM write and WhatsApp auto-send (the built-in tag plan still runs).</p>
          </div>

          {/* WhatsApp message (the click-to-chat body) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">WhatsApp message</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={waTemplates.length === 0}>
                    Load from template <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  {waTemplates.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs">No saved templates</DropdownMenuItem>
                  ) : (
                    waTemplates.map((tpl) => {
                      const text = (tpl.preview_text ?? '').trim() || (tpl.body ?? '').trim();
                      return (
                        <DropdownMenuItem
                          key={tpl.key}
                          disabled={!text}
                          onSelect={() => { if (text) setWaMessage(text); }}
                          className="text-xs"
                        >
                          {tpl.title || tpl.key}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              rows={2}
              placeholder={builtInWaPreview || 'Blank uses the built-in default; {name} = client first name'}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              This is the click-to-chat message body (what the dealer's WhatsApp opens pre-filled) — distinct from the auto-notification templates.
              Blank uses the built-in default. <code className="font-mono">{'{name}'}</code> = client first name. Loading a template fills this box; you can still edit it freely.
            </p>
          </div>

          {/* EasySocial tags-to-add — MULTI-SELECT over the synced tag dictionary
              (config.tags_cache); free-text fallback so a tag can be added even when
              the cache is empty. ALL selected tags are ADDed on apply. Empty => the
              status behaves exactly as today (single-override / hardcoded plan). */}
          <div className="space-y-1.5">
            <Label className="text-sm">EasySocial tags to add</Label>

            {/* Selected chips (removable). */}
            {tagsToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagsToAdd.map((name) => {
                  const id = idForTagName(name);
                  return (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-foreground"
                    >
                      {name}
                      {id && <span className="font-mono text-[10px] opacity-60">#{id}</span>}
                      <button
                        type="button"
                        onClick={() => removeAddTag(name)}
                        className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Pick from synced tags (toggle on/off). */}
            {cachedTags.length > 0 ? (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {cachedTags.map((t) => {
                  const on = tagsToAdd.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleAddTag(t.name)}
                      className={
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ' +
                        (on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')
                      }
                    >
                      {on && <Check className="h-3 w-3 text-primary" />}
                      {t.name} <span className="font-mono text-[10px] opacity-60">#{t.id}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-amber-400">
                No synced tags available — sync EasySocial tags first (Settings → EasySocial), or type a tag name below.
              </p>
            )}

            {/* Free-text custom tag (always available — fallback when a tag isn't synced). */}
            <div className="flex items-center gap-2">
              <Input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); }
                }}
                placeholder="Add a custom tag name…"
                className="h-8 text-sm"
                list={cachedTags.length > 0 ? TAG_DATALIST_ID : undefined}
              />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addCustomTag} disabled={!customTag.trim()}>
                Add
              </Button>
            </div>
            {cachedTags.length > 0 && (
              <datalist id={TAG_DATALIST_ID}>
                {cachedTags.map((t) => <option key={t.id} value={t.name} />)}
              </datalist>
            )}
            <p className="text-[11px] text-muted-foreground">
              All selected tags are ADDed on apply. The first selected is mirrored into the EasySocial status → tag overrides for back-compat. Empty = unchanged behaviour.
            </p>
          </div>

          {/* ════════════ ZTC-parity status-apply config ════════════
              A. EasySocial CRM (client_status + tag remove-mode) shows for BOTH
              tracks — since 2026-07-14 client-status applies also run the tag
              sync (config-driven; empty config = no-op).
              B. WhatsApp auto-send stays FINANCE-only (client statuses never
              message the client). */}
          {/* A. EasySocial CRM — client_status write + tag remove-mode (both tracks) */}
          {(slug || isClientCreate) && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="text-sm font-medium">EasySocial CRM (on apply)</div>

                {/* Client status value → easysocial_client_status */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Client status value</Label>
                  <Input
                    value={esClientStatus}
                    onChange={(e) => setEsClientStatus(e.target.value)}
                    placeholder="e.g. Submitted to Bank"
                    className="h-8 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Written to the EasySocial lead's status field on apply. Blank = not written.
                    {' '}Shipped behind a kill-switch (default OFF) until canary-verified — tags still sync regardless.
                  </p>
                </div>

                {/* Remove mode → tag_remove_mode (+ tag list) */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Tag remove mode</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['none', 'specific', 'all_except'] as const).map((m) => {
                      const selected = tagRemoveMode === m;
                      const labelMap = { none: 'None', specific: 'Remove specific', all_except: 'Remove all except' } as const;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setTagRemoveMode(m)}
                          className={
                            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition ' +
                            (selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')
                          }
                        >
                          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                          {labelMap[m]}
                        </button>
                      );
                    })}
                  </div>
                  {tagRemoveMode !== 'none' && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs text-muted-foreground">
                        {tagRemoveMode === 'specific'
                          ? 'Tags to REMOVE'
                          : 'Tags to KEEP (everything else gets removed)'}
                      </Label>
                      {cachedTags.length === 0 ? (
                        <p className="text-[11px] text-amber-400">
                          No synced tags available — sync EasySocial tags first (Settings → EasySocial) to pick from a list.
                        </p>
                      ) : (
                        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                          {cachedTags.map((t) => {
                            const idStr = String(t.id);
                            const on = tagsToRemove.includes(idStr);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleRemoveTag(idStr)}
                                className={
                                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ' +
                                  (on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')
                                }
                              >
                                {on && <Check className="h-3 w-3 text-primary" />}
                                {t.name} <span className="font-mono text-[10px] opacity-60">#{idStr}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {tagsToRemove.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Selected: {tagsToRemove.map(tagLabelForId).join(', ')}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Protected traffic-source/ops tags and the tag being added are never removed (safety filters always run last).
                      </p>
                    </div>
                  )}
                </div>
              </div>
          )}

          {/* B. WhatsApp auto-send — FINANCE statuses and (opt-in) CLIENT statuses.
              A curated template attached here fires on apply; left unset it stays
              silent (wa-status-send self-gates to skipped:'no_template'). */}
          {((type === 'finance' && slug) || type === 'client') && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="text-sm font-medium">WhatsApp auto-send (on apply)</div>

                {type === 'client' && (
                  <p className="text-[11px] text-muted-foreground">
                    Attaching a template makes this client status send a WhatsApp when it's applied (silent if left unset). Map a Body to <span className="font-medium text-foreground">WhatsApp To Client Info</span> to inject the typed message.
                  </p>
                )}

                {isNotifyOwned ? (
                  <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[12px] text-muted-foreground">
                    Per-status WhatsApp auto-send is disabled for this built-in status (to prevent double messaging). See <span className="font-medium text-foreground">Built-in behaviour</span> above for exactly what this status fires.
                  </div>
                ) : (
                  <>
                    {/* Template picker → whatsapp_template_key */}
                    <div className="space-y-1.5">
                      <Label className="text-sm">Send template</Label>
                      <Select
                        value={waTemplateKey || NO_TEMPLATE}
                        onValueChange={(v) => setWaTemplateKey(v === NO_TEMPLATE ? '' : v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="No auto-send" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_TEMPLATE} className="text-sm">None (no auto-send)</SelectItem>
                          {waTemplates.map((tpl) => {
                            const hasUrl = !!(tpl.send_url ?? '').trim();
                            return (
                              <SelectItem key={tpl.key} value={tpl.key} disabled={!hasUrl} className="text-sm">
                                {tpl.title || tpl.key}{!hasUrl ? ' (no send URL — set one in Templates)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        When set, this template auto-sends on apply (the curated send URL is the credential). Blank = no auto-send (current behaviour).
                      </p>
                    </div>

                    {/* Body 1/2/3 sources → wa_bodyN_source */}
                    {waTemplateKey && (
                      <div className="space-y-2">
                        {([
                          ['Body 1', waBody1Kind, setWaBody1Kind, waBody1Static, setWaBody1Static],
                          ['Body 2', waBody2Kind, setWaBody2Kind, waBody2Static, setWaBody2Static],
                          ['Body 3', waBody3Kind, setWaBody3Kind, waBody3Static, setWaBody3Static],
                        ] as const).map(([lbl, kind, setKind, lit, setLit]) => (
                          <div key={lbl} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{lbl} source</Label>
                            <div className="flex items-center gap-2">
                              <Select value={kind} onValueChange={(v) => (setKind as (s: string) => void)(v)}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BODY_SOURCE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {kind === 'static' && (
                                <Input
                                  value={lit}
                                  onChange={(e) => (setLit as (s: string) => void)(e.target.value)}
                                  placeholder="Static text"
                                  className="h-8 text-sm"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                        <p className="text-[11px] text-muted-foreground">
                          Each body var fills a placeholder in the template. "Status comment" uses the comment entered at apply time; unused vars are omitted.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 pb-6">
            <div>
              {type === 'client' && slug && (
                <Button variant="ghost" onClick={() => setConfirmDeleteOpen(true)} disabled={del.isPending} className="text-red-400 hover:text-red-300 gap-1">
                  {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={pending || isFinanceCreateBlocked} className="gap-1">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </Button>
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDeleteOpen}
          title="Delete client status?"
          description={`Delete client status "${label || slug}"? Applications keeping this value will show it until reassigned.`}
          onConfirm={() => { setConfirmDeleteOpen(false); void remove(); }}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
