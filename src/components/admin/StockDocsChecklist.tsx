import { useEffect, useRef, useState } from 'react';
import {
  FileCheck2, FileWarning, FileX2, Upload, Download, Loader2, MinusCircle, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  STOCK_DOC_DEFS, STOCK_DOC_STATUS_LABELS, StockDocStatus, StockDocKey,
} from '@/lib/stockDocs';
import {
  useVehicleStockDocs,
  useUpsertVehicleStockDoc,
  useUploadVehicleStockDoc,
  getStockDocUrl,
  countOutstanding,
  STOCK_DOC_TOTAL,
  VehicleStockDoc,
} from '@/hooks/useVehicleStockDocs';

const statusMeta: Record<StockDocStatus, { label: string; className: string; Icon: typeof FileCheck2 }> = {
  uploaded:   { label: STOCK_DOC_STATUS_LABELS.uploaded,   className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: FileCheck2 },
  not_needed: { label: STOCK_DOC_STATUS_LABELS.not_needed, className: 'bg-muted text-muted-foreground border-border',           Icon: MinusCircle },
  missing:    { label: STOCK_DOC_STATUS_LABELS.missing,    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',     Icon: FileWarning },
};

/**
 * Compact "X of N docs outstanding" badge — usable in inventory lists.
 * Pass either a docs array (already loaded) or a vehicleId to self-fetch.
 */
export const StockDocsSummaryBadge = ({
  vehicleId,
  docs,
  className,
}: {
  vehicleId?: string;
  docs?: VehicleStockDoc[];
  className?: string;
}) => {
  const { data: fetched } = useVehicleStockDocs(docs ? undefined : vehicleId);
  const list = docs ?? fetched;
  if (!list) return null;
  const outstanding = countOutstanding(list);
  if (outstanding === 0) {
    return (
      <Badge variant="outline" className={cn('gap-1 border-emerald-500/30 text-emerald-400', className)}>
        <FileCheck2 className="w-3 h-3" /> Docs complete
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn('gap-1 border-amber-500/30 text-amber-400', className)}>
      <FileWarning className="w-3 h-3" /> {outstanding} of {STOCK_DOC_TOTAL} docs outstanding
    </Badge>
  );
};

interface StockDocRowProps {
  vehicleId: string;
  doc: VehicleStockDoc;
}

const StockDocRow = ({ vehicleId, doc }: StockDocRowProps) => {
  const def = STOCK_DOC_DEFS.find((d) => d.key === doc.doc_key);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState(false);

  const upsert = useUpsertVehicleStockDoc();
  const upload = useUploadVehicleStockDoc();

  const meta = statusMeta[doc.status];
  const busy = upload.isPending || upsert.isPending;

  const handleFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    upload.mutate({ vehicleId, docKey: doc.doc_key as StockDocKey, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpen = async () => {
    if (!doc.file_path) return;
    setOpening(true);
    const url = await getStockDocUrl(doc.file_path);
    setOpening(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const toggleNotNeeded = () => {
    upsert.mutate({
      vehicleId,
      docKey: doc.doc_key as StockDocKey,
      status: doc.status === 'not_needed' ? 'missing' : 'not_needed',
    });
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
      <meta.Icon className={cn('w-5 h-5 shrink-0 mt-0.5', doc.status === 'uploaded' ? 'text-emerald-400' : doc.status === 'not_needed' ? 'text-muted-foreground' : 'text-amber-400')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{def?.label ?? doc.doc_key}</p>
          <Badge variant="outline" className={cn('text-[11px]', meta.className)}>{meta.label}</Badge>
        </div>
        {def?.hint && <p className="text-xs text-muted-foreground mt-0.5">{def.hint}</p>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
        {doc.status === 'uploaded' && doc.file_path && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen} title="View / download">
            {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title={doc.status === 'uploaded' ? 'Replace file' : 'Upload file'}
        >
          {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{doc.status === 'uploaded' ? 'Replace' : 'Upload'}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={toggleNotNeeded}
          disabled={busy}
          title={doc.status === 'not_needed' ? 'Mark as required again' : 'Mark not needed for this car'}
        >
          {doc.status === 'not_needed'
            ? <RotateCcw className="w-3.5 h-3.5" />
            : <FileX2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{doc.status === 'not_needed' ? 'Require' : 'Not needed'}</span>
        </Button>
      </div>
    </div>
  );
};

interface StockDocsChecklistProps {
  vehicleId: string;
  title?: string;
  description?: string;
}

/**
 * Per-vehicle stock-in documents checklist: the 4 required docs with status chips,
 * an upload button per item, and a per-item "Not needed" override. Includes the
 * compact outstanding-summary badge at the top.
 */
const StockDocsChecklist = ({
  vehicleId,
  title = 'Stock-in documents',
  description = 'Track the required documents for this car. Warns when outstanding — never blocks.',
}: StockDocsChecklistProps) => {
  const { data: docs = [], isLoading } = useVehicleStockDocs(vehicleId);
  const upsert = useUpsertVehicleStockDoc();

  // Default-create the 4 'missing' rows the first time the checklist is opened,
  // so each slot has a real row to attach status/notes to. Idempotent via upsert.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!vehicleId || seededRef.current || isLoading || docs.length === 0) return;
    const needsSeed = docs.some((d) => d.id.startsWith('placeholder-'));
    if (!needsSeed) {
      seededRef.current = true;
      return;
    }
    seededRef.current = true;
    docs
      .filter((d) => d.id.startsWith('placeholder-'))
      .forEach((d) => {
        upsert.mutate({ vehicleId, docKey: d.doc_key as StockDocKey, status: 'missing' });
      });
  }, [vehicleId, isLoading, docs, upsert]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <StockDocsSummaryBadge docs={docs} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <StockDocRow key={doc.doc_key} vehicleId={vehicleId} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StockDocsChecklist;
