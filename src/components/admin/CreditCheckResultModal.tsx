import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { toast } from 'sonner';
import { ImageIcon, Upload, X } from 'lucide-react';

export type CreditCheckOutcome = 'passed' | 'failed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outcome: CreditCheckOutcome;
  applicationId: string;
  /** Called after a successful save so parent can refetch. */
  onSaved?: (updated: { credit_check_status: CreditCheckOutcome; status: string; status_screenshot_url: string | null }) => void;
}

const PASS_OPTIONS = [
  { value: 'declined', label: 'Declined' },
  { value: 'declined_conditional', label: 'Conditionally Declined' },
  { value: 'pre_approved', label: 'Pre-Approved' },
];
const FAIL_OPTIONS = [
  { value: 'declined', label: 'Declined' },
  { value: 'blacklisted', label: 'Blacklisted' },
];

const CreditCheckResultModal = ({ open, onOpenChange, outcome, applicationId, onSaved }: Props) => {
  const updateApp = useUpdateFinanceApplication();
  const [mainStatus, setMainStatus] = useState<string>('');
  const [conditionalComment, setConditionalComment] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const statusOptions = outcome === 'passed' ? PASS_OPTIONS : FAIL_OPTIONS;

  useEffect(() => {
    if (open) {
      setMainStatus('');
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
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = (blob.type.split('/')[1] || 'png').toLowerCase();
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

  const acceptFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onSave = async () => {
    if (!mainStatus) {
      toast.error('Select a main status');
      return;
    }
    setSubmitting(true);
    try {
      let path: string | null = null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        path = `${applicationId}/${outcome}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('credit-check-screenshots')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
      }


      // Route through the central mutation so ALL status-driven side effects fire:
      // auto-mailer template, notify-pre-approval-internal / notify-declined /
      // notify-blacklisted / notify-app-submitted, EasySocial tag sync, status_history, etc.
      await updateApp.mutateAsync({
        id: applicationId,
        updates: {
          credit_check_status: outcome,
          status: mainStatus,
          status_screenshot_url: path,
        },
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
      <DialogContent className="bg-zinc-950 border border-white/10 text-white max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-light tracking-wide text-xl">
            <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider border ${accentBorder} ${accentBg} ${accentText}`}>
              Credit Check {outcome === 'passed' ? 'Passed' : 'Failed'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            Confirm the outcome, choose the resulting main status, and attach the bureau screenshot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-white/70 text-xs uppercase tracking-wider">Main status</Label>
            <Select value={mainStatus} onValueChange={setMainStatus}>
              <SelectTrigger className="bg-black/60 border-white/10 text-white focus:ring-white/30">
                <SelectValue placeholder="Select status…" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-white/10 text-white">
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70 text-xs uppercase tracking-wider">
              Screenshot (optional) — paste (Ctrl/Cmd+V) or upload
            </Label>
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) acceptFile(f);
              }}
              className={`relative rounded-lg border border-dashed border-white/15 bg-black/40 hover:border-white/30 transition-colors min-h-[160px] flex items-center justify-center p-3`}
            >
              {previewUrl ? (
                <div className="relative w-full">
                  <img src={previewUrl} alt="Screenshot preview" className="max-h-[260px] w-full object-contain rounded" />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="absolute top-1 right-1 p-1 rounded bg-black/70 border border-white/10 hover:bg-black"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3 text-white/80" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 text-white/50 cursor-pointer text-sm">
                  <ImageIcon className="w-6 h-6" />
                  <span>Paste with Ctrl/Cmd+V, drop a file, or</span>
                  <span className="inline-flex items-center gap-1.5 text-white/80 underline underline-offset-2">
                    <Upload className="w-3 h-3" /> choose a file
                  </span>
                  <input
                    type="file"
                    accept="image/*"
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !mainStatus}
            className="bg-white text-black hover:bg-white/90 font-medium"
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCheckResultModal;
