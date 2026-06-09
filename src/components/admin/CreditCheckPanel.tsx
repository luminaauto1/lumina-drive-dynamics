import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, ShieldCheck, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ScreenshotDropzone from './ScreenshotDropzone';

interface CreditCheckPanelProps {
  applicationId: string;
  status: string;
  creditCheckStatus?: string | null;
  statusScreenshotUrl?: string | null;
  onUpdated: (patch: Record<string, any>) => void;
}

const ELIGIBLE_STATUSES = new Set([
  'pending',
  'application_submitted',
  'ready_to_submit',
  'documents_received',
  'validations_pending',
  'validations_complete',
]);

const BUCKET = 'credit-check-screenshots';

async function uploadScreenshot(applicationId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${applicationId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/png',
  });
  if (error) throw error;
  return path;
}

const CreditCheckPanel = ({
  applicationId,
  status,
  creditCheckStatus,
  statusScreenshotUrl,
  onUpdated,
}: CreditCheckPanelProps) => {
  const [failOpen, setFailOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Fail dialog state
  const [failStatus, setFailStatus] = useState<'declined' | 'blacklisted'>('declined');
  const [failFile, setFailFile] = useState<File | null>(null);
  const [failSubmitting, setFailSubmitting] = useState(false);

  // Bank feedback dialog state (after Pass)
  const [feedbackStatus, setFeedbackStatus] = useState<'pre_approved' | 'declined'>('pre_approved');
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  if (!ELIGIBLE_STATUSES.has(status)) return null;

  const handlePass = async () => {
    try {
      const { error } = await supabase
        .from('finance_applications')
        .update({
          credit_check_status: 'passed',
          status: 'sent_to_banks',
        })
        .eq('id', applicationId);
      if (error) throw error;
      onUpdated({ credit_check_status: 'passed', status: 'sent_to_banks' });
      toast.success('Credit check passed · sent to banks');
      setFeedbackStatus('pre_approved');
      setFeedbackFile(null);
      setFeedbackOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to pass credit check');
    }
  };

  const handleFailSubmit = async () => {
    if (!failFile) { toast.error('Please attach a screenshot'); return; }
    setFailSubmitting(true);
    try {
      const path = await uploadScreenshot(applicationId, failFile);
      const { error } = await supabase
        .from('finance_applications')
        .update({
          credit_check_status: 'failed',
          status_screenshot_url: path,
          status: failStatus,
          is_archived: true,
        })
        .eq('id', applicationId);
      if (error) throw error;
      onUpdated({
        credit_check_status: 'failed',
        status_screenshot_url: path,
        status: failStatus,
        is_archived: true,
      });
      toast.success(`Marked as ${failStatus}`);
      setFailOpen(false);
      setFailFile(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    } finally {
      setFailSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackFile) { toast.error('Please attach a screenshot'); return; }
    setFeedbackSubmitting(true);
    try {
      const path = await uploadScreenshot(applicationId, feedbackFile);
      const updates: Record<string, any> = {
        status_screenshot_url: path,
        status: feedbackStatus,
      };
      if (feedbackStatus === 'declined') updates.is_archived = true;
      const { error } = await supabase
        .from('finance_applications')
        .update(updates)
        .eq('id', applicationId);
      if (error) throw error;
      onUpdated(updates);
      toast.success(feedbackStatus === 'pre_approved' ? 'Marked as Pre-Approved' : 'Marked as Declined');
      setFeedbackOpen(false);
      setFeedbackFile(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-white tracking-wide uppercase">Credit Check</h3>
            <p className="text-xs text-white/40 mt-0.5">
              Internal verdict before bank submission.
              {creditCheckStatus && (
                <span className="ml-2 inline-block text-[10px] uppercase tracking-wider text-white/70 border border-white/15 bg-white/5 px-1.5 py-0.5 rounded">
                  {creditCheckStatus}
                </span>
              )}
            </p>
          </div>
          {statusScreenshotUrl && (
            <span className="text-[10px] text-white/40 inline-flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> screenshot saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={handlePass}
            className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            Pass Credit Check
          </button>
          <button
            onClick={() => { setFailFile(null); setFailStatus('declined'); setFailOpen(true); }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Fail Credit Check
          </button>
        </div>
      </div>

      {/* FAIL DIALOG */}
      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent className="bg-zinc-950 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-light tracking-wide text-xl">Fail Credit Check</DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              Select the final status and attach the credit bureau / system screenshot as proof.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Final Status</Label>
              <Select value={failStatus} onValueChange={(v) => setFailStatus(v as any)}>
                <SelectTrigger className="bg-black/60 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                  <SelectItem value="declined" className="focus:bg-white/10 focus:text-white">Declined</SelectItem>
                  <SelectItem value="blacklisted" className="focus:bg-white/10 focus:text-white">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Screenshot</Label>
              <ScreenshotDropzone file={failFile} onFileChange={setFailFile} hint="Drop, click, or paste the credit screenshot" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailOpen(false)} className="text-white/60 hover:text-white hover:bg-white/5">Cancel</Button>
            <Button
              onClick={handleFailSubmit}
              disabled={failSubmitting || !failFile}
              className="bg-white text-black hover:bg-white/90 font-medium"
            >
              {failSubmitting ? 'Submitting…' : 'Confirm & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BANK FEEDBACK DIALOG (after Pass) */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="bg-zinc-950 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-light tracking-wide text-xl">Bank Feedback</DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              Once the bank responds, record the outcome and attach the proof screenshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Bank Verdict</Label>
              <Select value={feedbackStatus} onValueChange={(v) => setFeedbackStatus(v as any)}>
                <SelectTrigger className="bg-black/60 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                  <SelectItem value="pre_approved" className="focus:bg-white/10 focus:text-white">Pre-Approved</SelectItem>
                  <SelectItem value="declined" className="focus:bg-white/10 focus:text-white">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Bank Proof Screenshot</Label>
              <ScreenshotDropzone file={feedbackFile} onFileChange={setFeedbackFile} hint="Drop, click, or paste the bank response screenshot" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFeedbackOpen(false)} className="text-white/60 hover:text-white hover:bg-white/5">Later</Button>
            <Button
              onClick={handleFeedbackSubmit}
              disabled={feedbackSubmitting || !feedbackFile}
              className="bg-white text-black hover:bg-white/90 font-medium"
            >
              {feedbackSubmitting ? 'Submitting…' : 'Confirm & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreditCheckPanel;
