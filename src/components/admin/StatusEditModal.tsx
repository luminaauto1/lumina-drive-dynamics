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

import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, Trash2, Check } from 'lucide-react';
import {
  useStatusConfig,
  useStatusOverrides,
  useUpsertStatusOverride,
  useDeleteStatusOverride,
  useEasySocialSettings,
  useUpdateEasySocialSettings,
} from '@/hooks/useZtcSettings';
import { getWhatsAppMessage } from '@/lib/statusConfig';

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

const slugifyClientLabel = (label: string): string =>
  'client_' + label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function StatusEditModal({
  mode,
  slug,
  onClose,
}: {
  mode: 'finance' | 'client';
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

  const existing = useMemo(() => overrides.find((o) => o.slug === slug), [overrides, slug]);
  const isClientCreate = mode === 'client' && !slug;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [cls, setCls] = useState(existing?.color_class ?? FALLBACK_CLASS);
  const [hidden, setHidden] = useState(!!existing?.is_hidden);
  const [commentRequired, setCommentRequired] = useState(!!existing?.comment_required);
  const [commentPrompt, setCommentPrompt] = useState(existing?.comment_prompt ?? '');
  const [isInternal, setIsInternal] = useState(!!existing?.is_internal);
  const [waMessage, setWaMessage] = useState(existing?.whatsapp_message ?? '');
  const [tag, setTag] = useState(existing?.easysocial_tag_to_add ?? '');
  const [error, setError] = useState('');

  // Effective slug for previews / writes.
  const effectiveSlug = mode === 'finance' ? (slug ?? '') : (slug ?? slugifyClientLabel(label));
  const previewClass = cls || FALLBACK_CLASS;
  const previewLabel = label || effectiveSlug || 'Preview';
  const builtInWaPreview = mode === 'finance' && slug ? getWhatsAppMessage(slug, '{name}') : '';

  const titleText = mode === 'finance'
    ? 'Edit finance status'
    : isClientCreate ? 'Add client status' : 'Edit client status';

  const save = async () => {
    setError('');
    if (!label.trim()) { setError('Label is required.'); return; }
    if (commentRequired && !commentPrompt.trim()) {
      setError('When you require a comment, give a prompt the user sees.');
      return;
    }

    let writeSlug = effectiveSlug;
    let sortOrder = existing?.sort_order ?? 0;

    if (mode === 'client') {
      if (isClientCreate) {
        writeSlug = slugifyClientLabel(label);
        if (!writeSlug || writeSlug === 'client_') { setError('Enter a label with at least one letter or number.'); return; }
        // Collision check against existing client slugs (finance slugs can't collide
        // due to the 'client_' prefix).
        if (allClientStatuses.some((c) => c.value === writeSlug)) {
          setError('A client status with that name already exists.');
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
        status_type: mode,
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
    if (!slug || mode !== 'client') return;
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
          {/* Status type (read-only context) */}
          <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            {mode === 'finance' ? (
              <>Finance — fixed slug (<code className="font-mono text-foreground/80">{slug}</code>), presentation + rules editable.</>
            ) : (
              <>Client status — free-form. {slug ? <>Slug <code className="font-mono text-foreground/80">{slug}</code>.</> : 'A slug is generated from the label on save.'}</>
            )}
          </div>

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

          {/* WhatsApp message */}
          <div className="space-y-1.5">
            <Label className="text-sm">WhatsApp message</Label>
            <Textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              rows={2}
              placeholder={builtInWaPreview || 'Blank uses the built-in default; {name} = client first name'}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Blank uses the built-in default. <code className="font-mono">{'{name}'}</code> = client first name.</p>
          </div>

          {/* EasySocial tag-to-add */}
          <div className="space-y-1.5">
            <Label className="text-sm">EasySocial tag to add</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="EasySocial tag name (optional)" className="h-8 text-sm" />
            <p className="text-[11px] text-muted-foreground">Mirrored into the EasySocial status → tag overrides on save.</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 pb-6">
            <div>
              {mode === 'client' && slug && (
                <Button variant="ghost" onClick={remove} disabled={del.isPending} className="text-red-400 hover:text-red-300 gap-1">
                  {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={pending} className="gap-1">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
