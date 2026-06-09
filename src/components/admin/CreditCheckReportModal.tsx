import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

const CreditCheckReportModal = ({ open, onOpenChange }: Props) => {
  const today = useMemo(() => new Date(), []);
  const firstOfMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const [from, setFrom] = useState<string>(toIso(firstOfMonth));
  const [to, setTo] = useState<string>(toIso(today));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Array<{ status: string; resulting_status: string | null; updated_at: string; full_name: string | null; first_name: string | null; last_name: string | null }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Inclusive day range — convert "to" to end-of-day.
        const start = new Date(`${from}T00:00:00.000Z`).toISOString();
        const end = new Date(`${to}T23:59:59.999Z`).toISOString();
        const { data, error } = await supabase
          .from('finance_applications')
          .select('credit_check_status, credit_check_first_checked_at, status, full_name, first_name, last_name')
          .in('credit_check_status', ['passed', 'failed'])
          .not('credit_check_first_checked_at', 'is', null)
          .gte('credit_check_first_checked_at', start)
          .lte('credit_check_first_checked_at', end)
          .order('credit_check_first_checked_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) {
          setRows(
            (data || []).map((r: any) => ({
              status: r.credit_check_status,
              resulting_status: r.status ?? null,
              updated_at: r.credit_check_first_checked_at,
              full_name: r.full_name,
              first_name: r.first_name,
              last_name: r.last_name,
            })),
          );
        }
      } catch (e) {
        console.error('[credit-check-report]', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, from, to]);

  const passed = rows.filter(r => r.status === 'passed').length;
  const failed = rows.filter(r => r.status === 'failed').length;
  const total = passed + failed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide text-xl">Credit Check Report</DialogTitle>
          <DialogDescription className="text-white/50 text-sm">
            Billable bureau pulls — counted once per application at the time of the first credit check. Toggling passed ↔ failed afterwards never re-counts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs uppercase tracking-wider">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-black/60 border-white/10 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs uppercase tracking-wider">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-black/60 border-white/10 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="rounded-lg border border-white/10 bg-black/40 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/50">Total</div>
            <div className="text-3xl font-light mt-1">{loading ? '—' : total}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300/80">Passed</div>
            <div className="text-3xl font-light mt-1 text-emerald-300">{loading ? '—' : passed}</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="text-[11px] uppercase tracking-wider text-red-300/80">Failed</div>
            <div className="text-3xl font-light mt-1 text-red-300">{loading ? '—' : failed}</div>
          </div>
        </div>

        <div className="mt-2 max-h-[260px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Outcome</th>
                <th className="text-left px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className="px-3 py-4 text-white/50">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-4 text-white/50">No credit checks recorded for this period.</td></tr>
              )}
              {!loading && rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${r.status === 'passed' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-white/70">{new Date(r.updated_at).toLocaleString('en-ZA', { hour12: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white hover:bg-white/5">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCheckReportModal;
