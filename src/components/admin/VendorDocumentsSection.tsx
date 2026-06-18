import { useRef, useState } from 'react';
import {
  useVendorDocuments, useUploadVendorDocument, useDeleteVendorDocument, openVendorDocument,
} from '@/hooks/useVendors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const DOC_TYPES = [
  { value: 'company_reg', label: 'Company Registration' },
  { value: 'vat_cert', label: 'VAT Certificate' },
  { value: 'bank_confirmation', label: 'Bank Confirmation' },
  { value: 'agreement', label: 'Agreement / Contract' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
];

export const VendorDocumentsSection = ({ vendorId }: { vendorId: string }) => {
  const { data: docs = [], isLoading } = useVendorDocuments(vendorId);
  const upload = useUploadVendorDocument();
  const removeDoc = useDeleteVendorDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('other');
  const [label, setLabel] = useState('');

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload.mutateAsync({ vendorId, file, label: label || file.name, docType });
    setLabel('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="border-t pt-4">
      <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
        Documents
      </h4>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label className="text-xs">Label (optional)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 2026 VAT cert" />
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={onPick}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" />
        <Button type="button" variant="outline" disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" />
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.label || d.file_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type} · {format(new Date(d.uploaded_at), 'dd MMM yyyy')}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openVendorDocument(d.file_path)} aria-label="Open">
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled={removeDoc.isPending}
                onClick={() => removeDoc.mutate(d)} aria-label="Delete">
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
