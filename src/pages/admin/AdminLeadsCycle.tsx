import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, Calendar, HelpCircle, Loader2, Share2, ShieldAlert, ShieldCheck, Users, Zap } from 'lucide-react';
import { endOfDay, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useLeadsCycleStats } from '@/hooks/useLeadsCycleStats';

type Preset = 'today' | 'yesterday' | '7d' | 'month' | 'custom';

const PRESETS: { key: Exclude<Preset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: 'month', label: 'Month' },
];

const AdminLeadsCycle = () => {
  const [preset, setPreset] = useState<Preset>('today');
  // Committed custom range — only ever a complete from/to pair.
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(subDays(new Date(), 6)),
    to: endOfDay(new Date()),
  });
  // In-progress calendar selection; `to` may be undefined mid-pick. Kept
  // separate from customRange so react-day-picker can start a fresh range.
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);

  // Preset boundaries follow the wall clock: tick the day key so a tab left
  // open across midnight doesn't keep querying yesterday as "Today".
  const [dayKey, setDayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  useEffect(() => {
    const id = setInterval(() => {
      const key = format(new Date(), 'yyyy-MM-dd');
      setDayKey((prev) => (prev === key ? prev : key));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
      case '7d':
        return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfDay(now) };
      case 'custom':
        return customRange;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customRange, dayKey]);

  const { data, isLoading, isError, refetch } = useLeadsCycleStats(range.from, range.to);

  return (
    <AdminLayout>
      <Helmet>
        <title>Leads Cycle — Admin | Lumina Auto</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header + date filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-semibold mb-2">Leads Cycle</h1>
            <p className="text-muted-foreground">TikTok lead intake at a glance</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={preset === key ? 'default' : 'outline'}
                onClick={() => setPreset(key)}
              >
                {label}
              </Button>
            ))}
            <Popover onOpenChange={(open) => { if (open) setDraftRange(undefined); }}>
              <PopoverTrigger asChild>
                <Button size="sm" variant={preset === 'custom' ? 'default' : 'outline'} className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {preset === 'custom'
                    ? `${format(customRange.from, 'dd MMM')} - ${format(customRange.to, 'dd MMM yyyy')}`
                    : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={draftRange}
                  onSelect={(selected) => {
                    setDraftRange(selected);
                    if (selected?.from && selected?.to) {
                      setCustomRange({ from: startOfDay(selected.from), to: endOfDay(selected.to) });
                      setPreset('custom');
                    }
                  }}
                  numberOfMonths={2}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
        </motion.div>

        {/* KPI cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="glass-card rounded-xl border border-border p-10 text-center space-y-3">
            <AlertTriangle className="w-6 h-6 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">
              Couldn't load lead stats — check your connection and try again.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Users} label="Leads received" value={String(data?.total ?? 0)} accent />
              <KpiCard icon={ShieldAlert} label="Blacklisted" value={String(data?.blacklisted ?? 0)} />
              <KpiCard icon={ShieldCheck} label="Not blacklisted" value={String(data?.notBlacklisted ?? 0)} />
              <KpiCard icon={HelpCircle} label="Unknown" value={String(data?.unknown ?? 0)} />
            </div>

            {/* Intake route — makes the Make.com -> direct cutover visible. Once
                Make is switched off, "Via Make.com" should stay at 0 for new
                days; anything landing there means the old scenario is still on. */}
            <div className="glass-card rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">How leads arrived</p>
              <div className="grid grid-cols-2 gap-4">
                <RouteStat
                  icon={Zap}
                  label="Direct from TikTok"
                  value={data?.direct ?? 0}
                  hint="TikTok webhook straight into Lumina"
                />
                <RouteStat
                  icon={Share2}
                  label="Via Make.com"
                  value={data?.viaMake ?? 0}
                  hint="The old relay — should stop once switched off"
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Older leads may count toward neither route — before the split was recorded,
                rows were only tagged as TikTok.
              </p>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

const KpiCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-5 border border-border"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-primary' : ''}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </motion.div>
);

const RouteStat = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number; hint: string }) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-muted/40 text-muted-foreground flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  </div>
);

export default AdminLeadsCycle;
