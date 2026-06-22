import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_OPTIONS, ADMIN_STATUS_LABELS } from '@/lib/statusConfig';

const TERMINAL = ['declined', 'blacklisted', 'lost'];

export function BulkStatusModal({
  appIds, updateApplication, onClose, onDone,
}: {
  appIds: string[];
  updateApplication: ReturnType<typeof useUpdateFinanceApplication>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);

  const run = async () => {
    if (!status) return;
    setRunning(true); setDone(0); setFailures([]);
    const fails: string[] = [];
    // Sequential — each row goes through the SAME mutation so every notification
    // fires (matches ZTC's per-row change-status loop). The hook toasts per row.
    for (const id of appIds) {
      try {
        const updates: any = { status };
        if (TERMINAL.includes(status)) updates.is_archived = true;
        if (status === 'sent_to_banks') updates.internal_status = 'no_notes';
        await updateApplication.mutateAsync({ id, updates });
      } catch {
        fails.push(id);
      }
      setDone((d) => d + 1);
    }
    setFailures(fails);
    setRunning(false);
    if (fails.length === 0) { onDone(); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change status for {appIds.length} application{appIds.length === 1 ? '' : 's'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Select new status…" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{ADMIN_STATUS_LABELS[s.value] || s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {running && <p className="text-sm text-muted-foreground">Processing {done}/{appIds.length}… (each fires its own notifications)</p>}
          {failures.length > 0 && <p className="text-sm text-red-400">{failures.length} failed — others applied. Close and retry the rest.</p>}
          {!running && <p className="text-[11px] text-muted-foreground">Each application is updated individually so its WhatsApp / email / CRM notification fires — expect one toast per application.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>Cancel</Button>
          <Button onClick={run} disabled={running || !status}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Apply to {appIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
