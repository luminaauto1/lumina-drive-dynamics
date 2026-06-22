import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFAndIUsers } from '@/hooks/useFAndIUsers';

type Platform = 'intelliapp' | 'lightstone';

// Lightstone returns no reference code, so we store a standard, copy-to-WhatsApp message
// in place of the reference. Detect it on re-open so editing keeps the right platform.
const LIGHTSTONE_PREFIX = 'App Submitted for';
const buildLightstoneRef = (name?: string) =>
  `App Submitted for ${(name && name.trim()) || 'Client'}, no supporting docs yet`;

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
  /** Client name, used to build the Lightstone message. */
  clientName?: string;
}

const BankReferenceModal = ({
  open,
  onOpenChange,
  onConfirm,
  defaultValue = '',
  showFAndIAssignment = false,
  defaultFAndIId = null,
  clientName,
}: BankReferenceModalProps) => {
  const [platform, setPlatform] = useState<Platform>('intelliapp');
  const [reference, setReference] = useState(defaultValue);
  const [fniId, setFniId] = useState<string | null>(defaultFAndIId);
  const [submitting, setSubmitting] = useState(false);
  const { data: fniUsers = [] } = useFAndIUsers();

  useEffect(() => {
    if (open) {
      const isLightstone = defaultValue.startsWith(LIGHTSTONE_PREFIX);
      setPlatform(isLightstone ? 'lightstone' : 'intelliapp');
      setReference(isLightstone ? '' : defaultValue);
      setFniId(defaultFAndIId);
    }
  }, [open, defaultValue, defaultFAndIId]);

  const lightstoneRef = buildLightstoneRef(clientName);
  const effectiveRef = platform === 'lightstone' ? lightstoneRef : reference.trim();
  const canConfirm = platform === 'lightstone' || !!reference.trim();

  const handleConfirm = async () => {
    if (!effectiveRef) return;
    setSubmitting(true);
    try {
      await onConfirm(effectiveRef, showFAndIAssignment ? fniId : undefined);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const platformBtn = (value: Platform, label: string) => (
    <Button
      type="button"
      variant="outline"
      onClick={() => setPlatform(value)}
      className={
        platform === value
          ? 'border-white bg-white/10 text-white hover:bg-white/15'
          : 'border-white/10 bg-transparent text-white/55 hover:text-white hover:bg-white/5'
      }
    >
      {label}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border border-white/10 text-white shadow-[0_0_60px_-15px_rgba(255,255,255,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-white tracking-wide font-light text-xl">
            Submit Application
          </DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            Choose the submission platform and capture the reference to copy into WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Platform */}
          <div className="space-y-2">
            <Label className="text-white/70 text-xs uppercase tracking-wider">Submission Platform</Label>
            <div className="grid grid-cols-2 gap-2">
              {platformBtn('intelliapp', 'IntelliApp')}
              {platformBtn('lightstone', 'Lightstone')}
            </div>
            <p className="text-[11px] text-white/40">
              {platform === 'intelliapp'
                ? 'IntelliApp returns a bank reference code — enter it below.'
                : 'Lightstone has no reference code — a standard message is generated for you to copy into WhatsApp.'}
            </p>
          </div>

          {/* Reference */}
          {platform === 'intelliapp' ? (
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
          ) : (
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Reference (auto-generated)</Label>
              <Input
                readOnly
                value={lightstoneRef}
                className="bg-black/60 border-white/10 text-white/80 font-mono placeholder:text-white/20"
              />
              <p className="text-[11px] text-white/40">Saved in place of the bank reference; copy it from the badge to send on WhatsApp.</p>
            </div>
          )}

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
            disabled={!canConfirm || submitting}
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
