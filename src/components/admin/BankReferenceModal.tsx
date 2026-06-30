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
// the operator a ready-made message to copy into WhatsApp. Only mention docs when the
// client ACTUALLY has them (most don't) — never state the absence of docs.
const buildLightstoneMsg = (name?: string, docsReceived?: boolean) =>
  `App Submitted for ${(name && name.trim()) || 'Client'}${docsReceived ? ', documents will be mailed' : ''}`;

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
          ? 'border-foreground/40 bg-muted text-foreground hover:bg-muted/80'
          : 'border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
      }
    >
      {label}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-border text-foreground shadow-[0_0_60px_-15px_rgba(255,255,255,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-foreground tracking-wide font-light text-xl">
            Submit Application
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Choose the submission platform, then capture the reference or copy the message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Platform */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Submission Platform</Label>
            <div className="grid grid-cols-2 gap-2">
              {platformBtn('intelliapp', 'IntelliApp')}
              {platformBtn('lightstone', 'Lightstone')}
            </div>
          </div>

          {/* Reference / message */}
          {platform === 'intelliapp' ? (
            <div className="space-y-2">
              <Label htmlFor="bank-ref" className="text-muted-foreground text-xs uppercase tracking-wider">
                Bank Reference Code
              </Label>
              <Input
                id="bank-ref"
                autoFocus
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                placeholder="e.g. ABS-2026-08821"
                className="bg-background border-input text-foreground font-mono tracking-wider placeholder:text-muted-foreground/60 focus-visible:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">IntelliApp returns a bank reference code — enter it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Message to copy</Label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-md bg-background border border-border px-3 py-2 text-sm text-foreground">
                  {lightstoneMsg}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyMsg}
                  className="border-border bg-muted text-foreground hover:bg-muted/80 shrink-0"
                  title="Copy message"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Lightstone has no reference code — nothing is stored as a reference. Copy this message and send it on WhatsApp.
              </p>
            </div>
          )}

          {showFAndIAssignment && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Assign F&amp;I
              </Label>
              <Select
                value={fniId ?? '__unassigned__'}
                onValueChange={(v) => setFniId(v === '__unassigned__' ? null : v)}
              >
                <SelectTrigger className="bg-background border-input text-foreground focus:ring-ring">
                  <SelectValue placeholder="Select F&I…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__" className="text-muted-foreground">
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted/40">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            {submitting ? 'Submitting…' : 'Confirm Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BankReferenceModal;
