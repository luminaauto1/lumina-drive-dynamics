import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import type { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_OPTIONS, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';

// Terminal statuses also archive (mirrors AdminFinance line ~1090 — 'lost' is a
// defensive extra that's never a STATUS_OPTIONS value; kept for parity).
const TERMINAL = ['declined', 'blacklisted', 'lost'];

export function StatusChangeModal({
  app, updateApplication, onClose,
}: {
  app: FinanceApplication;
  updateApplication: ReturnType<typeof useUpdateFinanceApplication>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>((app as any).status || 'pending');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!status || status === (app as any).status) { onClose(); return; }
    setBusy(true);
    try {
      // EXACT reuse of AdminFinance's mutation path → notify-*/easysocial/auto-mailer
      // + status_history all fire identically. Never a parallel side-effect path.
      const updates: any = { status };
      if (TERMINAL.includes(status)) updates.is_archived = true;
      if (status === 'sent_to_banks') updates.internal_status = 'no_notes';
      await updateApplication.mutateAsync({ id: app.id, updates });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change status</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            {(app as any).full_name || [(app as any).first_name, (app as any).last_name].filter(Boolean).join(' ') || 'Applicant'}
          </p>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{ADMIN_STATUS_LABELS[s.value] || s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Sends the same WhatsApp / email / CRM notifications as the Finance page.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || status === (app as any).status}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
