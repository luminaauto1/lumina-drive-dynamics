import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFAndIUsers } from '@/hooks/useFAndIUsers';

interface BankReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Confirm handler. When `showFAndIAssignment` is true the second arg
   * carries the selected F&I user id (or null for unassigned).
   */
  onConfirm: (reference: string, fniId?: string | null) => Promise<void> | void;
  defaultValue?: string;
  showFAndIAssignment?: boolean;
  defaultFAndIId?: string | null;
}

const BankReferenceModal = ({
  open,
  onOpenChange,
  onConfirm,
  defaultValue = '',
  showFAndIAssignment = false,
  defaultFAndIId = null,
}: BankReferenceModalProps) => {
  const [reference, setReference] = useState(defaultValue);
  const [fniId, setFniId] = useState<string | null>(defaultFAndIId);
  const [submitting, setSubmitting] = useState(false);
  const { data: fniUsers = [] } = useFAndIUsers();

  useEffect(() => {
    if (open) {
      setReference(defaultValue);
      setFniId(defaultFAndIId);
    }
  }, [open, defaultValue, defaultFAndIId]);

  const handleConfirm = async () => {
    if (!reference.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reference.trim(), showFAndIAssignment ? fniId : undefined);
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
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="e.g. ABS-2026-08821"
              className="bg-black/60 border-white/10 text-white font-mono tracking-wider placeholder:text-white/20 focus-visible:ring-white/30"
            />
          </div>

          {showFAndIAssignment && (
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">
                Assign F&amp;I
              </Label>
              <Select
                value={fniId ?? '__unassigned__'}
                onValueChange={(v) => setFniId(v === '__unassigned__' ? null : v)}
              >
                <SelectTrigger className="bg-black/60 border-white/10 text-white focus:ring-white/30">
                  <SelectValue placeholder="Select F&I…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                  <SelectItem value="__unassigned__" className="text-white/60">
                    Unassigned
                  </SelectItem>
                  {fniUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="inline-flex items-center gap-2">
                        {u.name}
                        {u.role === 'senior_f_and_i' && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Senior
                          </span>
                        )}
                      </span>
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
