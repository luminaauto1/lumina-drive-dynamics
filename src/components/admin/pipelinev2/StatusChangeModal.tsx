import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import type { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { StatusSelect } from '@/components/admin/StatusSelect';
import { useStatusConfig } from '@/hooks/useZtcSettings';

// Terminal statuses also archive (mirrors AdminFinance line ~1090 — 'lost' is a
// defensive extra that's never a STATUS_OPTIONS value; kept for parity).
const TERMINAL = ['declined', 'blacklisted', 'lost'];

export function StatusChangeModal({
  app, updateApplication, onClose, role,
}: {
  app: FinanceApplication;
  updateApplication: ReturnType<typeof useUpdateFinanceApplication>;
  onClose: () => void;
  /** Staff role — finance status options are filtered to what this role may set. */
  role?: string | null;
}) {
  const [status, setStatus] = useState<string>((app as any).status || 'pending');
  const [busy, setBusy] = useState(false);
  const { labels: financeLabels } = useStatusConfig();

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
          <StatusSelect
            track="finance"
            value={status}
            onChange={setStatus}
            role={role}
            labelOverrides={financeLabels}
          />
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
