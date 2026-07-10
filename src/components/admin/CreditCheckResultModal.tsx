import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { compressPdf } from '@/lib/pdfCompression';
import { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';
import { FileText, ImageIcon, Upload, X } from 'lucide-react';

export type CreditCheckOutcome = 'passed' | 'failed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outcome: CreditCheckOutcome;
  applicationId: string;
  /** Called after a successful save so parent can refetch. */
  onSaved?: (updated: { credit_check_status: CreditCheckOutcome; status: string; status_screenshot_url: string | null }) => void;
}

// A PASSED credit check moves the app forward in the pipeline — the outcome
// statuses are the pre-bank ones (slugs from statusConfig.ts), not decline states.
const PASS_OPTIONS = [
  { value: 'ready_to_submit', label: 'Ready to Submit' },
  { value: 'sent_to_banks', label: 'Sent to Banks' },
  { value: 'application_submitted', label: 'Ready To Load' },
];
const FAIL_OPTIONS = [
  { value: 'declined', label: 'Declined' },
  { value: 'declined_conditional', label: 'Conditionally Declined' },
  { value: 'blacklisted', label: 'Blacklisted' },
];

const CreditCheckResultModal = ({ open, onOpenChange, outcome, applicationId, onSaved }: Props) => {
  const updateApp = useUpdateFinanceApplication();
  const [mainStatus, setMainStatus] = useState<string>('');
  const [creditScore, setCreditScore] = useState<string>('');
  const [conditionalComment, setConditionalComment] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const statusOptions = outcome === 'passed' ? PASS_OPTIONS : FAIL_OPTIONS;

  useEffect(() => {
    if (open) {
      setMainStatus('');
      setCreditScore('');
      setConditionalComment('');
      setFile(null);
      setPreviewUrl(null);
    }
  }, [open]);

  // Clipboard paste handler — works whenever the modal is open.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/') || item.type === 'application/pdf') {
          const blob = item.getAsFile();
          if (blob) {
            const ext = (blob.type.split('/')[1] || 'png').toLowerCase().replace('pdf', 'pdf');
            const named = new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type });
            acceptFile(named);
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  // Images preview inline; documents (PDF/Word) show as a named chip instead.
  const DOC_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const acceptFile = (f: File) => {
    const isImage = f.type.startsWith('image/');
    const isDoc = DOC_TYPES.includes(f.type) || /\.(pdf|docx?)$/i.test(f.name);
    if (!isImage && !isDoc) {
      toast.error('Only images or documents (PDF/Word) are allowed');
      return;
    }
    setFile(f);
    setPreviewUrl(isImage ? URL.createObjectURL(f) : null);
  };

  const onSave = async () => {
    if (!mainStatus) {
      toast.error('Select a main status');
      return;
    }
    if (mainStatus === 'declined_conditional' && !conditionalComment.trim()) {
      toast.error('Please add a comment explaining the conditional decline');
      return;
    }
    setSubmitting(true);
    try {
      let path: string | null = null;
      if (file) {
        // Images get compressed; PDFs get rasterised down (best-effort); Word docs upload as-is.
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const toUpload = isImage ? await compressImage(file) : isPdf ? await compressPdf(file) : file;
        const ext = (toUpload.name.split('.').pop() || (isImage ? 'png' : 'pdf')).toLowerCase();
        path = `${applicationId}/${outcome}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('credit-check-screenshots')
          .upload(path, toUpload, { contentType: toUpload.type || 'application/octet-stream', upsert: false });
        if (upErr) throw upErr;
      }

      // Build updated notes with prepended audit entry for conditional decline comment
      let updatedNotes: string | undefined;
      // Fetch current notes + first-checked timestamp in one go.
      const { data: existing } = await supabase
        .from('finance_applications')
        .select('notes, credit_check_first_checked_at')
        .eq('id', applicationId)
        .maybeSingle();

      if (mainStatus === 'declined_conditional') {
        const ts = new Date().toLocaleString('en-ZA', { hour12: false });
        const entry = `[${ts}] CONDITIONAL DECLINE (F&I): ${conditionalComment.trim()}`;
        updatedNotes = existing?.notes ? `${entry}\n\n${existing.notes}` : entry;
      }

      // Stamp first-check time exactly once per application — toggling passed↔failed never changes it,
      // so the Credit Check Report counts each app a single time regardless of subsequent edits.
      const firstCheckedAt = (existing as any)?.credit_check_first_checked_at
        ? null
        : new Date().toISOString();

      // Route through the central mutation so ALL status-driven side effects fire:
      // auto-mailer template, notify-pre-approval-internal / notify-declined /
      // notify-blacklisted / notify-app-submitted, EasySocial tag sync, status_history, etc.
      await updateApp.mutateAsync({
        id: applicationId,
        updates: {
          credit_check_status: outcome,
          status: mainStatus,
          status_screenshot_url: path,
          ...(creditScore.trim() ? { credit_score: parseInt(creditScore, 10) } : {}),
          ...(updatedNotes !== undefined ? { notes: updatedNotes } : {}),
          ...(firstCheckedAt ? { credit_check_first_checked_at: firstCheckedAt } : {}),
        } as any,
      });

      // Universal activity trail — record the credit-check outcome with detail.
      // (The status change itself is logged by useUpdateFinanceApplication.)
      void logActivity({
        actionType: 'credit_check',
        note: `Credit check ${outcome === 'passed' ? 'PASSED' : 'FAILED'}`
          + (creditScore.trim() ? ` · score ${creditScore.trim()}` : '')
          + (path ? ' · screenshot attached' : ''),
        applicationId,
      });

      toast.success(`Credit check ${outcome === 'passed' ? 'passed' : 'failed'} recorded`);
      onSaved?.({ credit_check_status: outcome, status: mainStatus, status_screenshot_url: path });
      onOpenChange(false);
    } catch (e: any) {
      console.error('[credit-check save]', e);
      toast.error(e?.message || 'Failed to save credit check');
    } finally {
      setSubmitting(false);
    }
  };

  const accentBorder = outcome === 'passed' ? 'border-emerald-500/30' : 'border-red-500/30';
  const accentText = outcome === 'passed' ? 'text-emerald-400' : 'text-red-400';
  const accentBg = outcome === 'passed' ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-border text-foreground max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-light tracking-wide text-xl">
            <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider border ${accentBorder} ${accentBg} ${accentText}`}>
              Credit Check {outcome === 'passed' ? 'Passed' : 'Failed'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Confirm the outcome, choose the resulting main status, and attach the bureau screenshot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Main status</Label>
            <Select value={mainStatus} onValueChange={setMainStatus}>
              <SelectTrigger className="bg-background border-input text-foreground focus:ring-ring">
                <SelectValue placeholder="Select status…" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Credit Score <span className="text-muted-foreground normal-case tracking-normal">— optional</span>
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={creditScore}
              onChange={(e) => setCreditScore(e.target.value)}
              placeholder="e.g. 645"
              className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">The bureau score the customer received, if shown.</p>
          </div>

          {mainStatus === 'declined_conditional' && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                F&amp;I Comment <span className="text-amber-400 normal-case tracking-normal">— required, goes to admin inbox</span>
              </Label>
              <Textarea
                value={conditionalComment}
                onChange={(e) => setConditionalComment(e.target.value)}
                placeholder="e.g. Recommend a cheaper vehicle under R250k, or larger deposit required…"
                rows={3}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-ring"
                maxLength={1000}
              />
              <p className="text-[11px] text-muted-foreground">
                This note will be timestamped and prepended to the application's internal notes.
              </p>
            </div>
          )}



          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Screenshot or document (optional) — paste (Ctrl/Cmd+V) or upload
            </Label>
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) acceptFile(f);
              }}
              className={`relative rounded-lg border border-dashed border-border bg-muted/40 hover:border-foreground/30 transition-colors min-h-[160px] flex items-center justify-center p-3`}
            >
              {previewUrl ? (
                <div className="relative w-full">
                  <img src={previewUrl} alt="Screenshot preview" className="max-h-[260px] w-full object-contain rounded" />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="absolute top-1 right-1 p-1 rounded bg-background/70 border border-border hover:bg-background"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3 text-foreground/80" />
                  </button>
                </div>
              ) : file ? (
                <div className="flex items-center gap-3 w-full px-3 py-4 rounded border border-border bg-background/60">
                  <FileText className="w-6 h-6 text-foreground/70 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — will upload on save</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="p-1 rounded bg-background/70 border border-border hover:bg-background shrink-0"
                    aria-label="Remove document"
                  >
                    <X className="w-3 h-3 text-foreground/80" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 text-muted-foreground cursor-pointer text-sm">
                  <ImageIcon className="w-6 h-6" />
                  <span>Paste with Ctrl/Cmd+V, drop a file (image or PDF/Word), or</span>
                  <span className="inline-flex items-center gap-1.5 text-foreground/80 underline underline-offset-2">
                    <Upload className="w-3 h-3" /> choose a file
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) acceptFile(f);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted/40">
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !mainStatus}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCheckResultModal;
