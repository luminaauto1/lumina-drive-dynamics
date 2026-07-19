import { useRef, useState } from 'react';
import { Banknote, CheckCircle2, ChevronDown, Download, Loader2, Truck, Upload, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Deal, ChecklistStep, PickupOrDelivery } from '@/lib/dealdesk/types';
import { CHECKLIST_STEP_LABEL, CHECKLIST_STEP_OPTIONS } from '@/lib/dealdesk/types';
import { useDealChecklist, useSaveChecklist } from '@/hooks/dealdesk/useDealDesk';
import {
  useDocumentSettings, resolveDealChecklistConfig,
  DEAL_CHECKLIST_SECTIONS, type DealChecklistItem, type DealChecklistSectionKey,
} from '@/hooks/useDocumentSettings';
import {
  useDealChecklistDocs, useUpsertDealChecklistDoc, useUploadDealChecklistDoc,
  getDealChecklistDocUrl, findChecklistDoc, type DealChecklistDoc,
} from '@/hooks/useDealChecklistDocs';

const STEP_DOT: Record<ChecklistStep, string> = {
  not_started: 'bg-muted-foreground/40', requested: 'bg-blue-400', in_progress: 'bg-amber-400',
  done: 'bg-emerald-400', not_applicable: 'bg-muted-foreground/30',
};

/** Leading icon per checklist section — makes the header band read as a heading. */
const SECTION_ICON: Record<DealChecklistSectionKey, LucideIcon> = {
  car_prep: Wrench, delivery_prep: Truck, payout: Banknote,
};

/** 'done' and 'N/A' both count as complete for the section progress chip. */
const isComplete = (s: ChecklistStep) => s === 'done' || s === 'not_applicable';

function ItemRow({ dealId, section, item, doc }: {
  dealId: string;
  section: DealChecklistSectionKey;
  item: DealChecklistItem;
  doc: DealChecklistDoc | undefined;
}) {
  const upsert = useUpsertDealChecklistDoc();
  const upload = useUploadDealChecklistDoc();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState(false);

  const status: ChecklistStep = doc?.status ?? 'not_started';
  const busy = upsert.isPending || upload.isPending;
  const missingDoc = status === 'done' && !doc?.file_path;

  const handleFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    upload.mutate({ dealId, section, itemKey: item.key, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpen = async () => {
    if (!doc?.file_path) return;
    setOpening(true);
    const url = await getDealChecklistDocUrl(doc.file_path);
    setOpening(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm">
          <span className={cn('h-2 w-2 rounded-full shrink-0', STEP_DOT[status])} /> {item.label}
        </span>
        {doc?.file_name && (
          <p className="text-[11px] text-muted-foreground truncate pl-4">{doc.file_name}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
        {doc?.file_path && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen} title="View / download">
            {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </Button>
        )}
        {/* 'Done' with no file is a red flag — the paper trail is missing. */}
        <Button
          variant="outline" size="sm"
          className={cn('h-8 gap-1', missingDoc && 'border-red-500/40 text-red-400 hover:bg-red-500/10')}
          onClick={() => fileInputRef.current?.click()} disabled={busy}
          title={missingDoc ? 'Marked done but no document uploaded' : doc?.file_path ? 'Replace file' : 'Upload file'}
        >
          {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{doc?.file_path ? 'Replace' : 'Upload'}</span>
        </Button>
        <Select
          value={status}
          onValueChange={(v) => upsert.mutate({ dealId, section, itemKey: item.key, status: v as ChecklistStep })}
        >
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHECKLIST_STEP_OPTIONS.map((o) => <SelectItem key={o} value={o}>{CHECKLIST_STEP_LABEL[o]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ChecklistTab({ deal }: { deal: Deal }) {
  const { data: settings, isLoading: settingsLoading } = useDocumentSettings();
  const { data: docs, isLoading: docsLoading } = useDealChecklistDocs(deal.id);
  const { data: checklist } = useDealChecklist(deal.id);
  const saveChecklist = useSaveChecklist();
  const [open, setOpen] = useState<Record<DealChecklistSectionKey, boolean>>({
    car_prep: true, delivery_prep: true, payout: true,
  });

  if (settingsLoading || docsLoading) {
    return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  }

  const config = resolveDealChecklistConfig(settings?.dealChecklistConfig);

  return (
    <div className="space-y-5">
      {DEAL_CHECKLIST_SECTIONS.map((sec) => {
        const items = config[sec.key];
        const done = items.filter((it) => {
          const d = findChecklistDoc(docs, sec.key, it.key);
          return d ? isComplete(d.status) : false;
        }).length;
        const complete = items.length > 0 && done === items.length;
        const SectionIcon = SECTION_ICON[sec.key];

        return (
          <Collapsible key={sec.key} open={open[sec.key]} onOpenChange={(v) => setOpen((p) => ({ ...p, [sec.key]: v }))}>
            <div className="rounded-lg border border-border">
              <CollapsibleTrigger asChild>
                {/* Header BAND, not a row: tinted background + icon + uppercase title. */}
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 bg-muted/40 px-3 py-3 text-left',
                    open[sec.key] ? 'rounded-t-lg' : 'rounded-lg',
                  )}
                >
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', !open[sec.key] && '-rotate-90')} />
                  <SectionIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm font-semibold uppercase tracking-wide">{sec.label}</span>
                  <span className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums',
                    complete
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                      : 'border-border bg-background text-muted-foreground',
                  )}>
                    {done}/{items.length}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border divide-y divide-border">
                  {items.length === 0 && (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      No items configured. Add some in Settings → Deal Checklist.
                    </p>
                  )}
                  {items.map((it) => (
                    <ItemRow key={it.key} dealId={deal.id} section={sec.key} item={it}
                      doc={findChecklistDoc(docs, sec.key, it.key)} />
                  ))}

                  {sec.key === 'delivery_prep' && (
                    <>
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Handover</span>
                        <Select
                          value={checklist?.pickup_or_delivery || 'delivery'}
                          onValueChange={(v) => saveChecklist.mutate({ dealId: deal.id, patch: { pickup_or_delivery: v as PickupOrDelivery } })}
                        >
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="pickup">Pickup</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle2 className={cn('w-4 h-4', checklist?.delivery_ready ? 'text-emerald-400' : 'text-muted-foreground')} />
                          Delivery ready
                        </span>
                        <Switch
                          checked={!!checklist?.delivery_ready}
                          disabled={saveChecklist.isPending}
                          onCheckedChange={(v) => saveChecklist.mutate({ dealId: deal.id, patch: { delivery_ready: v }, currentStage: deal.deal_stage })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
