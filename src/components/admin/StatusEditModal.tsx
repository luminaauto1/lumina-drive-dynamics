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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Save, Trash2, Check, ChevronDown, ArrowRight } from 'lucide-react';
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
import { statusToTab, PIPELINE_TABS } from '@/lib/pipelinev2/tabs';

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

const slugifyClientLabel = (label: string): string =>
  'client_' + label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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
  const { allClientStatuses } = useStatusConfig();
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

  const existing = useMemo(() => overrides.find((o) => o.slug === slug), [overrides, slug]);
  const isClientCreate = type === 'client' && !slug;
  // On CREATE, selecting Finance is inert (built-in slugs aren't row-created here).
  const isFinanceCreateBlocked = !isEdit && type === 'finance';

  const [label, setLabel] = useState(existing?.label ?? '');
  const [cls, setCls] = useState(existing?.color_class ?? FALLBACK_CLASS);
  const [hidden, setHidden] = useState(!!existing?.is_hidden);
  const [commentRequired, setCommentRequired] = useState(!!existing?.comment_required);
  const [commentPrompt, setCommentPrompt] = useState(existing?.comment_prompt ?? '');
  const [isInternal, setIsInternal] = useState(!!existing?.is_internal);
  const [waMessage, setWaMessage] = useState(existing?.whatsapp_message ?? '');
  const [tag, setTag] = useState(existing?.easysocial_tag_to_add ?? '');
  const [tagSeeded, setTagSeeded] = useState(false);
  const [error, setError] = useState('');

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
      if (typeof fallback === 'string' && fallback) setTag(fallback);
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

  // Which pipeline tab a FINANCE status routes the application to (read-only —
  // Lumina lanes are hardcoded in pipelinev2/tabs.ts; this just surfaces the
  // existing slug→lane mapping for clarity). Empty for client statuses.
  const destTabLabel = useMemo(() => {
    if (type !== 'finance' || !slug) return '';
    const tabKey = statusToTab(slug);
    return PIPELINE_TABS.find((t) => t.key === tabKey)?.label ?? '';
  }, [type, slug]);

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
        is_internal: isInternal,
        easysocial_tag_to_add: tag.trim() ? tag.trim() : null,
        status_type: type,
      });

      // Mirror the EasySocial tag into the live integration path (read-modify-write).
      const tagOverrides: Record<string, string> = { ...((easySocial?.config?.tag_add_overrides as Record<string, string>) ?? {}) };
      if (tag.trim()) tagOverrides[writeSlug] = tag.trim();
      else delete tagOverrides[writeSlug];
      const config = { ...(easySocial?.config ?? {}), tag_add_overrides: tagOverrides };
      await updateEasySocial.mutateAsync({ config });

      onClose();
    } catch {
      /* hooks toast their own errors */
    }
  };

  const remove = async () => {
    if (!slug || type !== 'client') return;
    if (!window.confirm(`Delete client status "${label || slug}"? Applications keeping this value will show it until reassigned.`)) return;
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

          {/* Destination pipeline tab (READ-ONLY). Lumina lanes are hardcoded in
              pipelinev2/tabs.ts — this surfaces, but does not edit, the slug→lane
              mapping. Finance only; client statuses don't move pipeline tabs. */}
          {type === 'finance' && slug && (
            <div className="space-y-1.5">
              <Label className="text-sm">Moves the application to</Label>
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2.5 py-2 text-sm">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">{destTabLabel || 'New Applications'}</span>
                <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground/70">Pipeline tab</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When this status is set on an application, it appears in this pipeline tab. The lane mapping is fixed and can't be edited here.
              </p>
            </div>
          )}
          {type === 'client' && (
            <p className="text-[11px] text-muted-foreground">Does not move pipeline tabs.</p>
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

          {/* Internal only (store-only) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox id="internal" checked={isInternal} onCheckedChange={(v) => setIsInternal(!!v)} />
              <Label htmlFor="internal" className="text-sm font-normal">Internal only</Label>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">Stored only — not yet wired to skip notifications.</p>
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

          {/* EasySocial tag-to-add — combobox over the synced tag dictionary
              (config.tags_cache); free-text fallback when the cache is empty. */}
          <div className="space-y-1.5">
            <Label className="text-sm">EasySocial tag to add</Label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="EasySocial tag name (optional)"
              className="h-8 text-sm"
              list={cachedTags.length > 0 ? TAG_DATALIST_ID : undefined}
            />
            {cachedTags.length > 0 && (
              <datalist id={TAG_DATALIST_ID}>
                {cachedTags.map((t) => <option key={t.id} value={t.name} />)}
              </datalist>
            )}
            <p className="text-[11px] text-muted-foreground">Mirrored into the EasySocial status → tag overrides on save. · pick from synced tags or type one</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 pb-6">
            <div>
              {type === 'client' && slug && (
                <Button variant="ghost" onClick={remove} disabled={del.isPending} className="text-red-400 hover:text-red-300 gap-1">
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
      </SheetContent>
    </Sheet>
  );
}
