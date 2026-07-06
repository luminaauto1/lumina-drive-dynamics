import { useMemo, useState, useEffect } from 'react';
import { useReferrals, useMarkReferralPaid, type Referral, type ReferralStatus } from '@/hooks/useReferrals';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Gift, CheckCircle2, Clock, AlertCircle, Activity, XCircle, Loader2, Mail, Phone, StickyNote, ExternalLink } from 'lucide-react';
import { LogReferralModal } from '@/components/admin/LogReferralModal';
import { cn } from '@/lib/utils';
import AdminLayout from '@/components/admin/AdminLayout';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ADMIN_STATUS_LABELS, STATUS_OPTIONS } from '@/lib/statusConfig';

type ViewKey = 'Pending' | 'In Progress' | 'Fee Outstanding' | 'Paid' | 'Declined';

const tabs: { key: ViewKey; label: string; icon: any; tone: string }[] = [
  { key: 'Pending', label: 'Pending', icon: Clock, tone: 'text-muted-foreground' },
  { key: 'In Progress', label: 'In Progress', icon: Activity, tone: 'text-sky-300' },
  { key: 'Fee Outstanding', label: 'Fees Outstanding', icon: AlertCircle, tone: 'text-amber-300' },
  { key: 'Paid', label: 'Paid', icon: CheckCircle2, tone: 'text-emerald-300' },
  { key: 'Declined', label: 'Declined', icon: XCircle, tone: 'text-rose-300' },
];

const statusBadge = (s: ReferralStatus) => {
  const map: Record<ReferralStatus, string> = {
    Pending: 'bg-muted text-muted-foreground border-border',
    'In Progress': 'bg-sky-950/60 text-sky-300 border-sky-800/60 [.desk-portal-light_&]:bg-sky-500/15 [.desk-portal-light_&]:text-sky-700 [.desk-portal-light_&]:border-sky-500/30',
    'Fee Outstanding': 'bg-amber-950/60 text-amber-300 border-amber-800/60 [.desk-portal-light_&]:bg-amber-500/15 [.desk-portal-light_&]:text-amber-700 [.desk-portal-light_&]:border-amber-500/30',
    Paid: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 [.desk-portal-light_&]:bg-emerald-500/15 [.desk-portal-light_&]:text-emerald-700 [.desk-portal-light_&]:border-emerald-500/30',
    Declined: 'bg-rose-950/60 text-rose-300 border-rose-800/60 [.desk-portal-light_&]:bg-rose-500/15 [.desk-portal-light_&]:text-rose-700 [.desk-portal-light_&]:border-rose-500/30',
  };
  return map[s];
};

const labelForStatus = (status?: string | null) => {
  if (!status) return '—';
  return (
    ADMIN_STATUS_LABELS[status] ||
    STATUS_OPTIONS.find((o) => o.value === status)?.label ||
    status
  );
};

const useLinkedAppStatuses = (ids: string[]) => {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = ids.slice().sort().join(',');

  useEffect(() => {
    if (!ids.length) {
      setMap({});
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('finance_applications')
        .select('id, status')
        .in('id', ids);
      if (!alive) return;
      const next: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        next[r.id] = r.status;
      });
      setMap(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
};

const AdminReferrals = () => {
  const { data, isLoading } = useReferrals();
  const markPaid = useMarkReferralPaid();
  const [view, setView] = useState<ViewKey>('In Progress');
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleMarkPaid = (id: string) => {
    setPendingId(id);
    markPaid.mutate(id, {
      onSettled: () => setPendingId(null),
    });
  };

  const counts = useMemo(() => {
    const c: Record<ViewKey, number> = {
      Pending: 0,
      'In Progress': 0,
      'Fee Outstanding': 0,
      Paid: 0,
      Declined: 0,
    };
    (data || []).forEach((r) => {
      if (r.status in c) c[r.status as ViewKey]++;
    });
    return c;
  }, [data]);

  const filtered = useMemo(() => (data || []).filter((r) => r.status === view), [data, view]);

  // Live app statuses for In Progress rows (and any row with a linked app).
  const linkedIds = useMemo(
    () => Array.from(new Set(filtered.map((r) => r.matched_application_id).filter(Boolean) as string[])),
    [filtered],
  );
  const liveStatuses = useLinkedAppStatuses(linkedIds);

  const showLiveCol = view === 'In Progress';

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
          <header className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-[0.2em]">
                <Gift className="h-3.5 w-3.5" /> Referral Suite
              </div>
              <h1 className="mt-2 text-3xl font-light text-foreground">Referrals</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Track who sent us business. Linked applications auto-flag fees on delivery, and mirror declines.
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
          <div className="inline-flex flex-wrap rounded-md border border-border bg-secondary p-1">
            {tabs.map((t) => {
              const active = view === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-xs font-medium rounded transition-colors',
                    active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Referrer (Owed)</TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Referee (Buyer)</TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Created</TableHead>
                  {showLiveCol && (
                    <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Live App Status</TableHead>
                  )}
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-right text-zinc-500 text-xs uppercase tracking-wider">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={showLiveCol ? 6 : 5} className="text-center text-zinc-500 py-12">Loading…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showLiveCol ? 6 : 5} className="text-center text-zinc-600 py-16 text-sm">
                      No referrals in this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r: Referral) => {
                    const isRowPending = pendingId === r.id && markPaid.isPending;
                    return (
                    <TableRow key={r.id} className="border-border hover:bg-muted/50 align-top">
                      <TableCell className="select-text">
                        <div className="text-foreground font-medium">{r.referrer_name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                          <Phone className="h-3 w-3" /> {r.referrer_phone}
                        </div>
                        {r.referrer_email && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Mail className="h-3 w-3" /> {r.referrer_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="select-text">
                        <div className="text-foreground font-medium">{r.referee_name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                          <Phone className="h-3 w-3" /> {r.referee_phone}
                        </div>
                        {r.referee_email && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Mail className="h-3 w-3" /> {r.referee_email}
                          </div>
                        )}
                        {r.matched_application_id && (
                          <Link
                            to={`/admin/finance?app=${r.matched_application_id}`}
                            className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 mt-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Open application
                          </Link>
                        )}
                        {r.notes && (
                          <div className="flex items-start gap-1.5 text-[11px] text-zinc-500 mt-1 max-w-xs">
                            <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{r.notes}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                        <div>{new Date(r.created_at).toLocaleDateString()}</div>
                        {r.updated_at && r.updated_at !== r.created_at && (
                          <div className="text-[10px] text-zinc-600 mt-0.5">
                            upd {new Date(r.updated_at).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>
                      {showLiveCol && (
                        <TableCell className="text-xs">
                          {r.matched_application_id ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-sky-800/60 bg-sky-950/40 text-sky-300 [.desk-portal-light_&]:border-sky-500/30 [.desk-portal-light_&]:bg-sky-500/15 [.desk-portal-light_&]:text-sky-700">
                              {labelForStatus(liveStatuses[r.matched_application_id])}
                            </span>
                          ) : (
                            <span className="text-zinc-600">Not linked</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className={cn('inline-flex items-center px-2 py-0.5 text-[11px] rounded border whitespace-nowrap', statusBadge(r.status))}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'Fee Outstanding' ? (
                          <Button
                            size="sm"
                            disabled={isRowPending}
                            onClick={() => handleMarkPaid(r.id)}
                            className="bg-emerald-700 hover:bg-emerald-600 text-zinc-50 text-xs h-8 min-w-[120px]"
                          >
                            {isRowPending ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Marking…
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Paid
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
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
