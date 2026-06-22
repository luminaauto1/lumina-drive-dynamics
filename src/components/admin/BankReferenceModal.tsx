import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useFAndIUsers } from '@/hooks/useFAndIUsers';

type Platform = 'intelliapp' | 'lightstone';

// Lightstone returns no reference code — we store NOTHING in bank_reference, but give
// the operator a ready-made message to copy into WhatsApp. The wording depends on
// whether supporting docs were already received (via email/WhatsApp).
const buildLightstoneMsg = (name?: string, docsReceived?: boolean) =>
  `App Submitted for ${(name && name.trim()) || 'Client'}, ${docsReceived ? 'documents will be mailed' : 'no supporting docs yet'}`;

interface BankReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Confirm handler. When `showFAndIAssignment` is true the second arg
   * carries the selected F&I user id (or null for unassigned). For Lightstone the
   * reference is an empty string (nothing is stored as a bank reference).
   */
  onConfirm: (reference: string, fniId?: string | null) => Promise<void> | void;
  defaultValue?: string;
  showFAndIAssignment?: boolean;
  defaultFAndIId?: string | null;
  /** Client name, used to build the Lightstone message. */
  clientName?: string;
  /** Whether supporting docs were already received (email/WhatsApp) — changes the Lightstone wording. */
  docsReceived?: boolean;
}

const BankReferenceModal = ({
  open,
  onOpenChange,
  onConfirm,
  defaultValue = '',
  showFAndIAssignment = false,
  defaultFAndIId = null,
  clientName,
  docsReceived = false,
}: BankReferenceModalProps) => {
  const [platform, setPlatform] = useState<Platform>('intelliapp');
  const [reference, setReference] = useState(defaultValue);
  const [fniId, setFniId] = useState<string | null>(defaultFAndIId);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: fniUsers = [] } = useFAndIUsers();

  useEffect(() => {
    if (open) {
      setPlatform('intelliapp');
      setReference(defaultValue);
      setFniId(defaultFAndIId);
      setCopied(false);
    }
  }, [open, defaultValue, defaultFAndIId]);

  const lightstoneMsg = buildLightstoneMsg(clientName, docsReceived);
  // IntelliApp stores the typed code; Lightstone stores nothing (empty reference).
  const effectiveRef = platform === 'lightstone' ? '' : reference.trim();
  const canConfirm = platform === 'lightstone' || !!reference.trim();

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(lightstoneMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
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
            Choose the submission platform, then capture the reference or copy the message.
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
          </div>

          {/* Reference / message */}
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
              <p className="text-[11px] text-white/40">IntelliApp returns a bank reference code — enter it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Message to copy</Label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-md bg-black/60 border border-white/10 px-3 py-2 text-sm text-white/85">
                  {lightstoneMsg}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyMsg}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 shrink-0"
                  title="Copy message"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-white/40">
                Lightstone has no reference code — nothing is stored as a reference. Copy this message and send it on WhatsApp.
              </p>
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
