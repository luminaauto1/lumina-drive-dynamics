import { useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, File as FileIcon, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/compressFile';
import {
  useDocuments, useUploadDocument, useDeleteDocument, getDocumentUrl,
  DocCategory, DOC_CATEGORY_LABELS, DOC_CATEGORIES, DocRecord,
} from '@/hooks/useDocuments';

interface DocumentManagerProps {
  title?: string;
  description?: string;
  /** Fixed category for uploads. If omitted, a category picker is shown. */
  category?: DocCategory;
  clientId?: string;
  applicationId?: string;
  vehicleId?: string;
  dealId?: string;
  /** Show a smaller, embedded layout (for modals / side panels). */
  compact?: boolean;
  /** Hide the upload controls (browse-only). */
  readOnly?: boolean;
  emptyHint?: string;
}

const iconFor = (mime?: string | null) => {
  if (mime?.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return FileIcon;
};

const DocumentManager = ({
  title,
  description,
  category,
  clientId,
  applicationId,
  vehicleId,
  dealId,
  compact = false,
  readOnly = false,
  emptyHint = 'No documents yet.',
}: DocumentManagerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedCategory, setPickedCategory] = useState<DocCategory>(category ?? 'client');
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const filters = { category, clientId, applicationId, vehicleId, dealId };
  const { data: docs = [], isLoading } = useDocuments(filters);
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const effectiveCategory = category ?? pickedCategory;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBusy(true);
    let ok = 0;
    for (const file of files) {
      try {
        await uploadDoc.mutateAsync({
          file,
          category: effectiveCategory,
          clientId,
          applicationId,
          vehicleId,
          dealId,
        });
        ok += 1;
      } catch {
        /* per-file error already toasted by the hook */
      }
    }
    setBusy(false);
    if (ok > 0) toast.success(`${ok} document${ok === 1 ? '' : 's'} uploaded`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpen = async (doc: DocRecord) => {
    setOpeningId(doc.id);
    const url = await getDocumentUrl(doc);
    setOpeningId(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = (doc: DocRecord) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    deleteDoc.mutate(doc);
  };

  return (
    <div className="space-y-3">
      {(title || !readOnly) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {!category && (
                <Select value={pickedCategory} onValueChange={(v) => setPickedCategory(v as DocCategory)}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {busy ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-6 bg-muted/20 rounded-lg border border-dashed">
          {emptyHint}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const Icon = iconFor(doc.mime_type);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30"
              >
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                    {!category && <> · {DOC_CATEGORY_LABELS[doc.category]}</>}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleOpen(doc)} title="View / download">
                  {openingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </Button>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentManager;
