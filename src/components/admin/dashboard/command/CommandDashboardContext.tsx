import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { isFinalizedDeal, dealNetProfit, dealReportDateObj } from '@/lib/dealMetrics';
import { useAnalyticsDashboard, type AnalyticsRange } from '@/hooks/useAnalyticsDashboard';

/**
 * Shared state for the Command Center (/admin) widget grid.
 *
 * Mirrors the analytics DashboardContext pattern: the period selector lives in
 * the page header, every widget reads the SAME period + datasets from this
 * context, and the underlying fetches are react-query backed so any number of
 * widgets dedupe to one network burst.
 *
 * The raw datasets (deal_records + finance_applications) are fetched ONCE and
 * the KPI maths re-buckets client-side per selected period — exactly the
 * computation the pre-grid AdminDashboard ran, lifted out of the page.
 */

/* ── Periods: current month, the 11 prior months, then Overall ── */

export type PeriodKey = string;

export interface PeriodOption {
  key: PeriodKey;
  label: string;
  /** null start = all-time ("Overall"). */
  start: Date | null;
  end: Date | null;
}

export function buildPeriods(now: Date): PeriodOption[] {
  const opts: PeriodOption[] = [
    {
      key: 'current',
      label: `${format(now, 'MMMM yyyy')} (Current)`,
      start: startOfMonth(now),
      end: endOfMonth(now),
    },
  ];
  for (let i = 1; i <= 11; i++) {
    const d = subMonths(now, i);
    opts.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy'),
      start: startOfMonth(d),
      end: endOfMonth(d),
    });
  }
  opts.push({ key: 'overall', label: 'Overall (All-Time)', start: null, end: null });
  return opts;
}

/* ── Period-scoped KPI maths (unchanged from the pre-grid dashboard) ── */

export interface CommandMetrics {
  grossProfit: number;
  totalUnits: number;
  approvals: number;
  deposits: number;
  closedDeals: number;
  pendingApps: number;
  avgYield: number;
  turnover: number;
}

const EMPTY_METRICS: CommandMetrics = {
  grossProfit: 0,
  totalUnits: 0,
  approvals: 0,
  deposits: 0,
  closedDeals: 0,
  pendingApps: 0,
  avgYield: 0,
  turnover: 0,
};

// Statuses that represent a bank approval (pre-approved or bank-validated).
const APPROVED_STATUSES = new Set(['pre_approved', 'approved', 'validations_complete']);

// Statuses that represent an application still awaiting action.
const PENDING_STATUSES = new Set([
  'pending',
  'application_submitted',
  'ready_to_submit',
  'sent_to_banks',
  'documents_received',
  'validations_pending',
]);

const inPeriod = (raw: string | null | undefined, p: PeriodOption): boolean => {
  if (!p.start || !p.end) return true; // Overall
  if (!raw) return false;
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return dt >= p.start && dt <= p.end;
};

/* ── Core datasets: one parallel burst, shared by every widget ── */

export interface CommandCoreData {
  target: number;
  deals: any[];
  apps: any[];
  /** Always today's finance-application count, independent of the period. */
  newAppsToday: number;
  activityToday: { totalVolume: number; leads: number; apps: number };
}

async function fetchCommandCore(): Promise<CommandCoreData> {
  const now = new Date();

  // "New apps today" window — always today, period-independent.
  const startOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const dayStart = startOfDayLocal.toISOString();
  const dayEnd = endOfDayLocal.toISOString();

  const [settingsRes, dealsRes, appsRes, appsTodayRes, leadsTodayRes, draftsTodayRes] =
    await Promise.all([
    supabase.from('site_settings').select('monthly_sales_target').single(),
    // Deal records — keep the full finalized set; bucket per selected period
    // client-side. Only the columns the KPI maths actually reads.
    supabase
      .from('deal_records')
      .select('gross_profit, sold_price, client_deposit, is_closed, sale_date, created_at')
      .limit(20000),
    // Finance applications — used for approvals / pending counts per period.
    supabase
      .from('finance_applications')
      .select('id, status, created_at, status_updated_at')
      .limit(20000),
    // "New apps today" — always today's finance applications.
    supabase
      .from('finance_applications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    // Today's top-of-funnel volume.
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('application_drafts')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', dayStart)
      .lte('updated_at', dayEnd),
    ]);

  // RLS-restricted roles legitimately see zero rows WITHOUT an error — that
  // stays a graceful empty dashboard. A real query failure must not render as
  // fake zeros: throw so react-query flips isError and widgets show their error
  // state. (site_settings is exempt: its .single() errors when the row isn't
  // visible to this role — fall back to the default target instead.)
  for (const r of [dealsRes, appsRes, appsTodayRes, leadsTodayRes, draftsTodayRes]) {
    if (r.error) throw r.error;
  }

  return {
    target: (settingsRes.data as any)?.monthly_sales_target || 10,
    deals: dealsRes.data || [],
    apps: appsRes.data || [],
    newAppsToday: appsTodayRes.count ?? 0,
    activityToday: {
      totalVolume: (leadsTodayRes.count ?? 0) + (draftsTodayRes.count ?? 0),
      leads: leadsTodayRes.count ?? 0,
      apps: appsTodayRes.count ?? 0,
    },
  };
}

/* ── Context ── */

export interface CommandDashboardValue {
  periods: PeriodOption[];
  periodKey: PeriodKey;
  setPeriodKey: (key: PeriodKey) => void;
  period: PeriodOption;
  /** The selected period mapped for the lum_analytics_* RPC hooks (Overall → wide custom range). */
  analyticsRange: AnalyticsRange;
  isLoading: boolean;
  isError: boolean;
  metrics: CommandMetrics;
  target: number;
  newAppsToday: number;
  activityToday: { totalVolume: number; leads: number; apps: number };
}

const Ctx = createContext<CommandDashboardValue | null>(null);

export function CommandDashboardProvider({ children }: { children: ReactNode }) {
  const periods = useMemo(() => buildPeriods(new Date()), []);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('current');
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];

  const core = useQuery({
    queryKey: ['command-dashboard-core'],
    queryFn: fetchCommandCore,
    staleTime: 60_000,
  });

  // Recompute all period-scoped KPIs whenever the period or raw data changes.
  const metrics: CommandMetrics = useMemo(() => {
    const data = core.data;
    if (!data) return EMPTY_METRICS;

    let grossProfit = 0;
    let turnover = 0;
    let totalUnits = 0;
    let deposits = 0;
    let closedDeals = 0;

    data.deals.forEach((deal: any) => {
      if (!isFinalizedDeal(deal)) return;
      const dt = dealReportDateObj(deal);
      const raw = dt ? format(dt, 'yyyy-MM-dd') : null;
      if (!inPeriod(raw, period)) return;
      grossProfit += dealNetProfit(deal);
      turnover += Number(deal.sold_price || 0);
      totalUnits += 1;
      deposits += Number(deal.client_deposit || 0);
      if (deal.is_closed === true) closedDeals += 1;
    });

    let approvals = 0;
    let pendingApps = 0;
    data.apps.forEach((a: any) => {
      // Approvals are dated by status change (status_updated_at) when known so a
      // re-approval lands in the right month; new/pending dated by creation.
      const approvalDate = a.status_updated_at || a.created_at;
      if (APPROVED_STATUSES.has(a.status) && inPeriod(approvalDate, period)) approvals += 1;
      if (PENDING_STATUSES.has(a.status) && inPeriod(a.created_at, period)) pendingApps += 1;
    });

    return {
      grossProfit,
      turnover,
      totalUnits,
      deposits,
      closedDeals,
      approvals,
      pendingApps,
      avgYield: totalUnits > 0 ? grossProfit / totalUnits : 0,
    };
  }, [core.data, period]);

  const analyticsRange = useMemo<AnalyticsRange>(
    () =>
      period.start && period.end
        ? {
            key: 'custom',
            from: format(period.start, 'yyyy-MM-dd'),
            to: format(period.end, 'yyyy-MM-dd'),
          }
        : { key: 'custom', from: '2000-01-01', to: format(new Date(), 'yyyy-MM-dd') },
    [period],
  );

  const value = useMemo<CommandDashboardValue>(
    () => ({
      periods,
      periodKey,
      setPeriodKey,
      period,
      analyticsRange,
      isLoading: core.isLoading,
      isError: core.isError,
      metrics,
      target: core.data?.target ?? 10,
      newAppsToday: core.data?.newAppsToday ?? 0,
      activityToday: core.data?.activityToday ?? { totalVolume: 0, leads: 0, apps: 0 },
    }),
    [periods, periodKey, period, analyticsRange, core.isLoading, core.isError, core.data, metrics],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommandDashboard(): CommandDashboardValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommandDashboard must be used within CommandDashboardProvider');
  return ctx;
}

/**
 * The lum_analytics_* RPC bundle (kpis / leaderboard / daily / snapshot) for the
 * selected Command Center period. React-query dedupes across widgets because
 * they all pass the same mapped range.
 */
export function useCommandAnalytics() {
  const { analyticsRange } = useCommandDashboard();
  return useAnalyticsDashboard(analyticsRange);
}
