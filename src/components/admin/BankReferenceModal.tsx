import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface BankReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reference: string) => Promise<void> | void;
  defaultValue?: string;
}

const BankReferenceModal = ({ open, onOpenChange, onConfirm, defaultValue = '' }: BankReferenceModalProps) => {
  const [reference, setReference] = useState(defaultValue);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setReference(defaultValue);
  }, [open, defaultValue]);

  const handleConfirm = async () => {
    if (!reference.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reference.trim());
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
        <div className="space-y-2 py-2">
          <Label htmlFor="bank-ref" className="text-white/70 text-xs uppercase tracking-wider">
            Bank Reference Code
          </Label>
          <Input
            id="bank-ref"
            autoFocus
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            placeholder="e.g. ABS-2026-08821"
            className="bg-black/60 border-white/10 text-white font-mono tracking-wider placeholder:text-white/20 focus-visible:ring-white/30"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reference.trim() || submitting}
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
