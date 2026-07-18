// NATIS tab — the post-delivery registration lifecycle for a deal.
//
//   header strip (countdown chip + VIN / bank / condition / vehicle / delivered)
//   → NATIS LIFE CYCLE stepper (Delivered → ID & POR → Original Natis →
//     Dealer stock → Blue File → Ready to send; stored in deal_records.natis_stage)
//   → location & plates card (wa.me click-to-chat when plates are done — no auto-send)
//   → NATIS document card (documents bucket, deal/{id}/natis/, signed-URL view)
//   → update log (manual 'natis_note' events) + change history (stage transitions).
//
// The 'Delivery ready' switch intentionally does NOT live here — it belongs to the
// Checklist tab. Completing 'Ready to send' (or 'Skip & finalize') marks the NATIS
// sent via useMarkNatisSent, which stamps natis_sent_at and clears the stage.

import { useRef, useState, type FormEvent } from 'react';
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, MapPin,
  MessageCircle, Plus, Send, SkipForward, Truck, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Deal, NatisLocation, NatisStage } from '@/lib/dealdesk/types';
import { CONDITION_LABEL, NATIS_LOCATION_LABEL, NATIS_STEPS } from '@/lib/dealdesk/types';
import { natisStatus } from '@/lib/dealdesk/natis';
import { formatDate, formatDateTime } from '@/lib/dealdesk/format';
import { cn } from '@/lib/utils';
import { NatisChip } from '../badges';
import {
  getNatisDocUrl, useAddNatisNote, useDealEvents, useDeskSettings, useMarkNatisSent,
  useSaveNatisFields, useSetNatisStage, useUploadNatisDoc,
} from '@/hooks/dealdesk/useDealDesk';

/** wa.me click-to-chat href for the plates-ready message (SA phone, leading 0 → 27). */
function platesReadyWaHref(phone: string, firstName: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  const msg = `Hi ${firstName}, your number plates and licence disc are ready. Please let us know when we can arrange fitment or collection. — Lumina Auto`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

function Info({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const empty = value == null || value === '';
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('truncate text-sm', mono && 'font-mono text-xs', empty && 'text-muted-foreground/50')} title={value ?? undefined}>
        {empty ? '—' : value}
      </div>
    </div>
  );
}

export function DeliveryTab({ deal }: { deal: Deal }) {
  const { data: settings } = useDeskSettings();
  const { data: events = [] } = useDealEvents(deal.id);
  const markNatis = useMarkNatisSent();
  const setStage = useSetNatisStage();
  const saveFields = useSaveNatisFields();
  const addNote = useAddNatisNote();
  const uploadDoc = useUploadNatisDoc();

  const [note, setNote] = useState('');
  const [openingDoc, setOpeningDoc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const natis = natisStatus(deal, settings);

  /* ---- effective lifecycle stage: stored value, defaulting to 'delivered' once
     the deal is delivered; null while not delivered / after NATIS was sent. ---- */
  const dealDelivered =
    !!deal.delivery_date || deal.deal_stage === 'delivered' || deal.deal_stage === 'cleared' || deal.deal_status === 'delivered';
  const stage: NatisStage | null = deal.natis_sent ? null : (deal.natis_stage ?? (dealDelivered ? 'delivered' : null));
  const stageIdx = deal.natis_sent ? NATIS_STEPS.length : stage ? NATIS_STEPS.findIndex((s) => s.key === stage) : -1;

  const currentStep = stage ? NATIS_STEPS[stageIdx] : null;
  const nextStep = stage && stageIdx < NATIS_STEPS.length - 1 ? NATIS_STEPS[stageIdx + 1] : null;
  const stepperBusy = setStage.isPending || markNatis.isPending;

  const onBack = () => {
    if (!stage || stageIdx <= 0) return;
    setStage.mutate({ dealId: deal.id, stage: NATIS_STEPS[stageIdx - 1].key, fromStage: stage });
  };
  const onForward = () => {
    if (!stage) return;
    // Completing the final step IS sending the NATIS.
    if (stage === 'ready_to_send') markNatis.mutate({ dealId: deal.id, sent: true, currentStage: deal.deal_stage });
    else if (nextStep) setStage.mutate({ dealId: deal.id, stage: nextStep.key, fromStage: stage });
  };
  const onSkip = () => markNatis.mutate({ dealId: deal.id, sent: true, currentStage: deal.deal_stage });

  const helper = deal.natis_sent
    ? `NATIS sent${deal.natis_sent_at ? ` on ${formatDateTime(deal.natis_sent_at)}` : ''} — the lifecycle is complete and the deal is cleared.`
    : !stage
      ? 'The NATIS lifecycle starts once the vehicle is delivered (set the delivery date / delivery-ready on the Checklist tab).'
      : currentStep?.helper ?? '';

  /* ---- location & plates ---- */
  const firstName = (deal.client_name || '').trim().split(/\s+/)[0] || 'there';
  const setLocation = (loc: NatisLocation) => {
    if (deal.natis_location === loc) return;
    saveFields.mutate({ dealId: deal.id, patch: { natis_location: loc }, summary: `Natis location set: ${NATIS_LOCATION_LABEL[loc]}` });
  };
  const onPlatesDisc = (checked: boolean) => {
    // Open the click-to-chat synchronously (popup-blocker friendly). Prefill only —
    // the user still presses Send inside WhatsApp. No auto-send infrastructure.
    if (checked && deal.natis_whatsapp_on_done && deal.client_phone) {
      window.open(platesReadyWaHref(deal.client_phone, firstName), '_blank', 'noopener,noreferrer');
    }
    saveFields.mutate({
      dealId: deal.id,
      patch: { natis_plates_disc_done: checked },
      summary: checked ? 'Plates & disc marked done' : 'Plates & disc reopened',
    });
  };
  const onWhatsappOptIn = (checked: boolean) => {
    saveFields.mutate({
      dealId: deal.id,
      patch: { natis_whatsapp_on_done: checked },
      summary: checked ? 'WhatsApp-on-done enabled' : 'WhatsApp-on-done disabled',
    });
  };

  /* ---- document ---- */
  const docName = deal.natis_doc_path ? (deal.natis_doc_path.split('/').pop() || '').replace(/^\d+-/, '') : null;
  const openDoc = async () => {
    if (!deal.natis_doc_path || openingDoc) return;
    setOpeningDoc(true);
    try {
      const url = await getNatisDocUrl(deal.natis_doc_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningDoc(false);
    }
  };
  const onFilePicked = (f: File | null) => {
    if (f) uploadDoc.mutate({ dealId: deal.id, file: f });
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ---- logs ---- */
  const stageEvents = events.filter((e) => e.event_type === 'natis_stage_changed');
  const natisEvents = events.filter(
    (e) => e.event_type !== 'natis_stage_changed' // stage moves live in Change history below
      && (e.event_type?.startsWith('natis') || /^natis\b/i.test(e.summary || '')),
  );
  const submitNote = (e: FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text || addNote.isPending) return;
    addNote.mutate({ dealId: deal.id, note: text }, { onSuccess: () => setNote('') });
  };

  return (
    <div className="space-y-4">
      {/* ── header strip ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4" /> NATIS</span>
          <NatisChip status={natis} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          <Info label="VIN" value={deal.vehicle_vin} mono />
          <Info label="Bank" value={deal.bank} />
          <Info label="Condition" value={deal.condition ? CONDITION_LABEL[deal.condition] : null} />
          <Info label="Vehicle" value={[deal.vehicle_make_model, deal.vehicle_year].filter(Boolean).join(' · ') || null} />
          <Info label="Delivered" value={formatDate(deal.delivery_date) || null} />
        </div>
      </section>

      {/* ── sent banner ──────────────────────────────────────────────── */}
      {deal.natis_sent && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            NATIS sent{deal.natis_sent_at ? ` · ${formatDateTime(deal.natis_sent_at)}` : ''}
          </span>
          <Button variant="outline" size="sm" disabled={markNatis.isPending}
            onClick={() => markNatis.mutate({ dealId: deal.id, sent: false, currentStage: deal.deal_stage })}>
            Undo
          </Button>
        </div>
      )}

      {/* ── NATIS LIFE CYCLE stepper ─────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Natis life cycle</div>

        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[520px] items-start" aria-label="Natis lifecycle steps">
            {NATIS_STEPS.map((step, idx) => {
              const done = idx < stageIdx;
              const current = idx === stageIdx;
              return (
                <li key={step.key} className="flex flex-1 items-start last:flex-none">
                  <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                        done && 'border-emerald-500 bg-emerald-500 text-white',
                        current && 'border-transparent bg-muted text-foreground ring-2 ring-[hsl(var(--desk-accent))] ring-offset-2 ring-offset-background',
                        !done && !current && 'border-border bg-muted/30 text-muted-foreground',
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span className={cn(
                      'text-[10px] leading-tight',
                      current ? 'font-semibold text-foreground' : done ? 'text-emerald-400' : 'text-muted-foreground',
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {idx < NATIS_STEPS.length - 1 && (
                    <span className={cn('mt-3.5 h-px min-w-3 flex-1', done ? 'bg-emerald-500/40' : 'bg-border')} aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {!deal.natis_sent && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack} disabled={!stage || stageIdx <= 0 || stepperBusy}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back
            </Button>
            <Button size="sm" onClick={onForward} disabled={!stage || stepperBusy}>
              {stepperBusy
                ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                : stage === 'ready_to_send'
                  ? <Send className="mr-1 h-3.5 w-3.5" />
                  : <ChevronRight className="mr-1 h-3.5 w-3.5" />}
              {stage === 'ready_to_send' ? 'Mark Natis sent' : nextStep?.advanceLabel ?? 'Advance'}
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={onSkip} disabled={markNatis.isPending}>
              <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip &amp; finalize
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{helper}</p>
      </section>

      {/* ── location & plates ────────────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4" /> Location &amp; plates</div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(NATIS_LOCATION_LABEL) as NatisLocation[]).map((loc) => {
            const selected = deal.natis_location === loc;
            return (
              <button
                key={loc} type="button" onClick={() => setLocation(loc)} disabled={saveFields.isPending}
                aria-pressed={selected}
                className={cn(
                  'rounded-md border px-3 py-2 text-left text-xs transition-colors',
                  selected
                    ? 'border-[hsl(var(--desk-accent))] bg-[hsl(var(--desk-accent)/0.08)] font-semibold text-foreground'
                    : 'border-input text-muted-foreground hover:bg-muted/50',
                )}
              >
                {NATIS_LOCATION_LABEL[loc]}
              </button>
            );
          })}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={deal.natis_whatsapp_on_done} disabled={saveFields.isPending}
            onCheckedChange={(v) => onWhatsappOptIn(v === true)} />
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp the client when marked done
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={deal.natis_plates_disc_done} disabled={saveFields.isPending}
            onCheckedChange={(v) => onPlatesDisc(v === true)} />
          <span>Plates &amp; disc done</span>
        </label>

        <p className="text-[11px] text-muted-foreground">
          Checking “Plates &amp; disc done” with WhatsApp enabled opens a prefilled wa.me chat to
          {deal.client_phone ? ` ${deal.client_phone}` : ' the client (no phone on file)'} — nothing is sent automatically.
        </p>
      </section>

      {/* ── NATIS document ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Natis document</div>

        {deal.natis_doc_path ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={docName ?? undefined}>{docName}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openDoc} disabled={openingDoc}>
                {openingDoc ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}
                View / download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadDoc.isPending}>
                {uploadDoc.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                Replace
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">No NATIS document uploaded yet.</span>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadDoc.isPending}>
              {uploadDoc.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
              Upload
            </Button>
          </div>
        )}
        <input ref={fileRef} type="file" className="hidden" accept="application/pdf,image/*"
          onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)} />
      </section>

      {/* ── update log ───────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-3">
        <div className="text-sm font-medium">Update log</div>
        <form onSubmit={submitNote} className="flex items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a Natis update…"
            className="h-8 text-sm" maxLength={500} />
          <Button type="submit" size="sm" variant="outline" disabled={!note.trim() || addNote.isPending}>
            {addNote.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            Add
          </Button>
        </form>
        {natisEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No Natis updates logged yet.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {natisEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--desk-accent))]" />
                <div className="min-w-0">
                  <div className="text-sm break-words">{e.summary}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDateTime(e.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── change history (stage transitions) ───────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-3">
        <div className="text-sm font-medium">Change history</div>
        {stageEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No stage changes yet.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {stageEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                <div className="min-w-0">
                  <div className="text-sm break-words">{e.summary}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDateTime(e.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
