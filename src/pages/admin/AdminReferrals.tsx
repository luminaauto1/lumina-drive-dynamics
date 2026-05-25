import { useMemo, useState } from 'react';
import { useReferrals, useMarkReferralPaid, type Referral, type ReferralStatus } from '@/hooks/useReferrals';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Gift, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { LogReferralModal } from '@/components/admin/LogReferralModal';
import { cn } from '@/lib/utils';
import AdminLayout from '@/components/admin/AdminLayout';

type ViewKey = 'Pending' | 'Fee Outstanding' | 'Paid';

const tabs: { key: ViewKey; label: string; icon: any; tone: string }[] = [
  { key: 'Pending', label: 'Pending', icon: Clock, tone: 'text-zinc-300' },
  { key: 'Fee Outstanding', label: 'Fees Outstanding', icon: AlertCircle, tone: 'text-amber-300' },
  { key: 'Paid', label: 'Paid', icon: CheckCircle2, tone: 'text-emerald-300' },
];

const statusBadge = (s: ReferralStatus) => {
  const map: Record<ReferralStatus, string> = {
    Pending: 'bg-zinc-800/60 text-zinc-300 border-zinc-700',
    'Fee Outstanding': 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    Paid: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  };
  return map[s];
};

const AdminReferrals = () => {
  const { data, isLoading } = useReferrals();
  const markPaid = useMarkReferralPaid();
  const [view, setView] = useState<ViewKey>('Fee Outstanding');
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<ViewKey, number> = { Pending: 0, 'Fee Outstanding': 0, Paid: 0 };
    (data || []).forEach((r) => {
      if (r.status in c) c[r.status as ViewKey]++;
    });
    return c;
  }, [data]);

  const filtered = useMemo(() => (data || []).filter((r) => r.status === view), [data, view]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-black text-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
          <header className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-[0.2em]">
                <Gift className="h-3.5 w-3.5" /> Referral Suite
              </div>
              <h1 className="mt-2 text-3xl font-light text-zinc-100">Referrals</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Track who sent us business. Finalized deals auto-flag matching referees as fee-owed.
              </p>
            </div>
            <Button
              onClick={() => setOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-black"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Log New Referral
            </Button>
          </header>

          {/* Segmented filter */}
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-1">
            {tabs.map((t) => {
              const active = view === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-xs font-medium rounded transition-colors',
                    active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', active && t.tone)} />
                  {t.label}
                  <span className="ml-1 text-[10px] text-zinc-500">({counts[t.key]})</span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-950/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Referrer (Owed)</TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Referee (Buyer)</TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Created</TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-right text-zinc-500 text-xs uppercase tracking-wider">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-zinc-500 py-12">Loading…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-zinc-600 py-16 text-sm">
                      No referrals in this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r: Referral) => (
                    <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-900/40">
                      <TableCell className="select-text">
                        <div className="text-zinc-200 font-medium">{r.referrer_name}</div>
                        <div className="text-xs text-zinc-500">{r.referrer_phone}</div>
                        {r.referrer_email && (
                          <div className="text-xs text-zinc-500">{r.referrer_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="select-text">
                        <div className="text-zinc-200 font-medium">{r.referee_name}</div>
                        <div className="text-xs text-zinc-500">{r.referee_phone}</div>
                        {r.referee_email && (
                          <div className="text-xs text-zinc-500">{r.referee_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center px-2 py-0.5 text-[11px] rounded border', statusBadge(r.status))}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'Fee Outstanding' ? (
                          <Button
                            size="sm"
                            disabled={markPaid.isPending}
                            onClick={() => markPaid.mutate(r.id)}
                            className="bg-emerald-700 hover:bg-emerald-600 text-zinc-50 text-xs h-8"
                          >
                            Mark as Paid
                          </Button>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <LogReferralModal open={open} onOpenChange={setOpen} />
      </div>
    </AdminLayout>
  );
};

export default AdminReferrals;
