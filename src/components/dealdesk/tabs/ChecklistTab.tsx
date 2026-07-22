import { useRef, useState } from 'react';
import { Banknote, CheckCircle2, ChevronDown, Download, Loader2, Truck, Upload, Wrench, X, type LucideIcon } from 'lucide-react';
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
  DEAL_CHECKLIST_SECTIONS, type ResolvedDealChecklistItem, type DealChecklistSectionKey,
} from '@/hooks/useDocumentSettings';
import {
  useDealChecklistDocs, useUpsertDealChecklistDoc, useUploadDealChecklistDoc,
  useDealChecklistFiles, useDeleteDealChecklistFile, filesForItem,
  getDealChecklistDocUrl, findChecklistDoc,
  type DealChecklistDoc, type DealChecklistFile,
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

/** One attached document: name, open, detach. */
function FileLine({ file, onRemove, removing }: {
  file: DealChecklistFile;
  onRemove: () => void;
  removing: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    const url = await getDealChecklistDocUrl(file.file_path);
    setOpening(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="flex items-center gap-1.5 pl-4">
      <button type="button" onClick={open}
        className="min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        title={file.file_name || file.file_path}>
        {opening ? 'Opening…' : (file.file_name || 'Document')}
      </button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={open} title="View / download">
        {opening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
        onClick={onRemove} disabled={removing} title="Remove this document">
        {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

function ItemRow({ dealId, section, item, doc, files }: {
  dealId: string;
  section: DealChecklistSectionKey;
  item: ResolvedDealChecklistItem;
  doc: DealChecklistDoc | undefined;
  files: DealChecklistFile[];
}) {
  const upsert = useUpsertDealChecklistDoc();
  const upload = useUploadDealChecklistDoc();
  const removeFile = useDeleteDealChecklistFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status: ChecklistStep = doc?.status ?? 'not_started';
  const busy = upsert.isPending || upload.isPending;
  // Items configured as "no document needed" (Settings → Deal Checklist) are
  // status-only: no upload/view controls and never a missing-doc flag.
  const requiresDoc = item.requiresDoc;
  const missingDoc = requiresDoc && status === 'done' && files.length === 0;

  const handleFiles = (list: FileList | null) => {
    const picked = Array.from(list || []);
    if (picked.length === 0) return;
    upload.mutate({ dealId, section, itemKey: item.key, files: picked });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <span className={cn('h-2 w-2 rounded-full shrink-0', STEP_DOT[status])} /> {item.label}
            {requiresDoc && files.length > 1 && (
              <span className="rounded-full border border-border bg-background px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {files.length}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {requiresDoc && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {/* 'Done' with no file is a red flag — the paper trail is missing. */}
              <Button
                variant="outline" size="sm"
                className={cn('h-8 gap-1', missingDoc && 'border-red-500/40 text-red-400 hover:bg-red-500/10')}
                onClick={() => fileInputRef.current?.click()} disabled={busy}
                title={missingDoc ? 'Marked done but no document uploaded' : 'Add one or more documents'}
              >
                {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{files.length ? 'Add' : 'Upload'}</span>
              </Button>
            </>
          )}
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

      {requiresDoc && files.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {files.map((f) => (
            <FileLine key={f.id} file={f} removing={removeFile.isPending}
              onRemove={() => removeFile.mutate(f)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChecklistTab({ deal }: { deal: Deal }) {
  const { data: settings, isLoading: settingsLoading } = useDocumentSettings();
  const { data: docs, isLoading: docsLoading } = useDealChecklistDocs(deal.id);
  const { data: allFiles } = useDealChecklistFiles(deal.id);
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
                      doc={findChecklistDoc(docs, sec.key, it.key)}
                      files={filesForItem(allFiles, sec.key, it.key)} />
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
