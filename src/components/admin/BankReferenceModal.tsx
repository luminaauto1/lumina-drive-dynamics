import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFniMembers } from '@/hooks/useFniMembers';

interface BankReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the reference and (when F&I selector is enabled) the assigned F&I user id. */
  onConfirm: (reference: string, assignedFniId?: string) => Promise<void> | void;
  defaultValue?: string;
  /** When true, the modal requires an F&I assignment before confirming. */
  requireFni?: boolean;
  defaultFniId?: string | null;
}

const BankReferenceModal = ({
  open,
  onOpenChange,
  onConfirm,
  defaultValue = '',
  requireFni = false,
  defaultFniId = null,
}: BankReferenceModalProps) => {
  const [reference, setReference] = useState(defaultValue);
  const [fniId, setFniId] = useState<string>(defaultFniId || '');
  const [submitting, setSubmitting] = useState(false);
  const { data: fniMembers = [] } = useFniMembers();

  useEffect(() => {
    if (open) {
      setReference(defaultValue);
      setFniId(defaultFniId || '');
    }
  }, [open, defaultValue, defaultFniId]);

  const canSubmit = !!reference.trim() && (!requireFni || !!fniId);

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(reference.trim(), requireFni ? fniId : undefined);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border border-white/10 text-white shadow-[0_0_60px_-15px_rgba(255,255,255,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-white tracking-wide font-light text-xl">
            Capture Bank Reference
          </DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            Enter the reference code returned by the bank for this submission.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bank-ref" className="text-white/70 text-xs uppercase tracking-wider">
              Bank Reference Code
            </Label>
            <Input
              id="bank-ref"
              autoFocus
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleConfirm(); }}
              placeholder="e.g. ABS-2026-08821"
              className="bg-black/60 border-white/10 text-white font-mono tracking-wider placeholder:text-white/20 focus-visible:ring-white/30"
            />
          </div>

          {requireFni && (
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">
                Assign F&amp;I <span className="text-red-400">*</span>
              </Label>
              <Select value={fniId} onValueChange={setFniId}>
                <SelectTrigger className="bg-black/60 border-white/10 text-white focus:ring-white/30">
                  <SelectValue placeholder="Select F&I team member…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                  {fniMembers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-white/40">No F&I members found</div>
                  )}
                  {fniMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id} className="text-white focus:bg-white/10 focus:text-white">
                      {m.full_name || m.email}
                      {m.is_senior && <span className="ml-2 text-[10px] text-pink-400 uppercase tracking-wider">Senior</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || submitting}
            className="bg-white text-black hover:bg-white/90 font-medium"
          >
            {submitting ? 'Submitting…' : 'Confirm Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BankReferenceModal;
