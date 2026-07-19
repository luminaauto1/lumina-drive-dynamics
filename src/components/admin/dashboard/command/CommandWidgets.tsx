import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Calculator,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  FileCheck2,
  PackageCheck,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { useDealDeskList, useDeskSettings } from '@/hooks/dealdesk/useDealDesk';
import { isAwaitingFinalize } from '@/components/dealdesk/isAwaitingFinalize';
import { natisStatus, isNatisAttention } from '@/lib/dealdesk/natis';
import {
  KpiBody,
  WidgetShell,
  WidgetHeading,
  ChartArea,
  WidgetLoading,
  WidgetError,
  TOOLTIP_STYLE,
  num,
  fmtMins,
} from '../widgets/shared';
import { fetchCreditCounts } from '../widgets/CreditWidgets';
import { useCommandDashboard, useCommandAnalytics } from './CommandDashboardContext';

/* ── Shared bits ──────────────────────────────────────────────────────────────── */

const fmtR = (v: number) => `R ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtN = (v: number) => v.toLocaleString();

/** Pulse skeleton for a KPI tile — no fake zeros while data loads. */
function KpiSkeleton() {
  return (
    <div className="flex h-full flex-col justify-between" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-5 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-2 space-y-2">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/** Optional whole-tile click target (keyboard-reachable, token-styled). */
function Clickable({ to, children }: { to?: string; children: ReactNode }) {
  const navigate = useNavigate();
  if (!to) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="block h-full w-full cursor-pointer text-left transition-opacity hover:opacity-80"
    >
      {children}
    </button>
  );
}

interface CommandKpiProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: any;
  color: string;
  to?: string;
}

/** Period-scoped KPI tile: skeleton while core data loads, error state on failure. */
function CommandKpi({ label, value, sub, icon, color, to }: CommandKpiProps) {
  const { isLoading, isError } = useCommandDashboard();
  if (isLoading) return <KpiSkeleton />;
  if (isError) return <WidgetError />;
  return (
    <Clickable to={to}>
      <KpiBody label={label} value={value} sub={sub} icon={icon} color={color} />
    </Clickable>
  );
}

/* ── The nine period KPI tiles (converted StatTiles) ──────────────────────────── */

export function GrossProfitWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Total GP"
      value={<span className="text-emerald-400">{fmtR(metrics.grossProfit)}</span>}
      sub="Gross profit (after split)"
      icon={DollarSign}
      color="text-emerald-400"
    />
  );
}

export function TotalUnitsWidget() {
  const { metrics, period, target } = useCommandDashboard();
  return (
    <CommandKpi
      label="Total Units"
      value={<span className="text-purple-400">{fmtN(metrics.totalUnits)}</span>}
      sub={period.start ? `/ ${target} target` : 'Deals finalized'}
      icon={Car}
      color="text-purple-400"
    />
  );
}

export function NewAppsTodayWidget() {
  const { newAppsToday } = useCommandDashboard();
  return (
    <CommandKpi
      label="New Apps Today"
      value={<span className="text-blue-400">{fmtN(newAppsToday)}</span>}
      sub="Always today (any period)"
      icon={UserPlus}
      color="text-blue-400"
      to={ADMIN_ROUTES.finance}
    />
  );
}

export function ApprovalsWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Total Approvals"
      value={<span className="text-green-400">{fmtN(metrics.approvals)}</span>}
      sub="Pre-approved / bank-approved"
      icon={CheckCircle2}
      color="text-green-400"
      to={ADMIN_ROUTES.finance}
    />
  );
}

export function DepositsWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Client Deposits"
      value={<span className="text-amber-400">{fmtR(metrics.deposits)}</span>}
      sub="Taken on finalized deals"
      icon={Banknote}
      color="text-amber-400"
    />
  );
}

export function ClosedDealsWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Closed Deals"
      value={<span className="text-emerald-400">{fmtN(metrics.closedDeals)}</span>}
      sub="Marked closed"
      icon={PackageCheck}
      color="text-emerald-400"
      to={ADMIN_ROUTES.dealDesk}
    />
  );
}

export function PendingAppsWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Pending Apps"
      value={<span className="text-orange-400">{fmtN(metrics.pendingApps)}</span>}
      sub="Awaiting action"
      icon={Clock}
      color="text-orange-400"
      to={ADMIN_ROUTES.pipelineV2}
    />
  );
}

export function AvgYieldWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Avg Yield / Unit"
      value={<span className="text-amber-400">{fmtR(metrics.avgYield)}</span>}
      sub="GP / units"
      icon={Calculator}
      color="text-amber-400"
    />
  );
}

export function TurnoverWidget() {
  const { metrics } = useCommandDashboard();
  return (
    <CommandKpi
      label="Total Turnover"
      value={<span className="text-blue-400">{fmtR(metrics.turnover)}</span>}
      sub="Vehicle revenue"
      icon={TrendingUp}
      color="text-blue-400"
    />
  );
}

/* ── Lead & Communication Activity strip (wide widget) ────────────────────────── */

function ActivityStat({
  label,
  value,
  icon: Icon,
  accent,
  to,
}: {
  label: string;
  value: number;
  icon: any;
  accent: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="rounded-lg border border-border bg-secondary/30 p-3 text-left transition-colors hover:bg-secondary/50"
    >
      <div className={`mb-1.5 flex items-center gap-2 ${accent}`}>
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </button>
  );
}

export function ActivityStripWidget() {
  const navigate = useNavigate();
  const { isLoading, isError, activityToday } = useCommandDashboard();

  if (isLoading) return <WidgetLoading />;
  if (isError) return <WidgetError />;

  return (
    <WidgetShell>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-semibold leading-tight">Lead &amp; Communication Activity</h3>
        </div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Today</span>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-3">
        <ActivityStat
          label="Total Volume"
          value={activityToday.totalVolume}
          icon={BarChart3}
          accent="text-emerald-400"
          to={ADMIN_ROUTES.leadAnalytics}
        />
        <ActivityStat
          label="New Leads"
          value={activityToday.leads}
          icon={UserPlus}
          accent="text-blue-400"
          to={ADMIN_ROUTES.pipelineV2}
        />
        <ActivityStat
          label="Finance Apps"
          value={activityToday.apps}
          icon={FileCheck2}
          accent="text-amber-400"
          to={ADMIN_ROUTES.finance}
        />
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
        <span>Top-of-funnel volume from WhatsApp + web</span>
        <button
          type="button"
          onClick={() => navigate(ADMIN_ROUTES.leadAnalytics)}
          className="inline-flex items-center text-foreground transition-colors hover:text-emerald-400"
        >
          Full analytics <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </button>
      </div>
    </WidgetShell>
  );
}

/* ── Credit checks pass/fail (period-scoped) ──────────────────────────────────── */

const CREDIT_COLORS = {
  passed: 'hsl(160 70% 45%)',
  failed: 'hsl(0 70% 55%)',
} as const;

function useCommandCreditCounts() {
  const { period, periodKey } = useCommandDashboard();
  // fetchCreditCounts filters on an exclusive [since, until) completion window.
  // Overall = unbounded (wide sentinel range).
  const since = period.start ? period.start.toISOString() : '1970-01-01T00:00:00.000Z';
  const until = period.end
    ? new Date(period.end.getTime() + 1).toISOString()
    : '2100-01-01T00:00:00.000Z';
  return useQuery({
    queryKey: ['command-credit-counts', periodKey],
    queryFn: () => fetchCreditCounts(since, until),
    staleTime: 60_000,
  });
}

function CreditStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function CommandCreditChecksWidget() {
  const { period } = useCommandDashboard();
  const { data, isLoading, isError } = useCommandCreditCounts();

  if (isLoading) return <WidgetLoading />;
  if (isError) return <WidgetError />;

  const passed = data?.passed ?? 0;
  const failed = data?.failed ?? 0;
  const pendingNow = data?.pendingNow ?? 0;
  const notRunNow = data?.notRunNow ?? 0;
  const completed = passed + failed;
  const pie = [
    { name: 'Passed', value: passed, fill: CREDIT_COLORS.passed },
    { name: 'Failed', value: failed, fill: CREDIT_COLORS.failed },
  ].filter((d) => d.value > 0);

  return (
    <WidgetShell>
      <WidgetHeading title="Credit checks" hint={`Completed in ${period.label}`} />
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <CreditStat label="Passed" value={passed} color="text-emerald-400" />
        <CreditStat label="Failed" value={failed} color="text-red-400" />
      </div>
      <ChartArea>
        {completed > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="hsl(var(--card))"
              >
                {pie.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No credit checks completed in this period
          </div>
        )}
      </ChartArea>
      <p className="mt-1 shrink-0 text-[11px] text-muted-foreground">
        {pendingNow.toLocaleString()} awaiting outcome
        {notRunNow > 0 && ` · ${notRunNow.toLocaleString()} not yet run`}
        <span className="opacity-70"> (current total)</span>
      </p>
    </WidgetShell>
  );
}

/* ── Top reps (lum_analytics_leaderboard, period-scoped) ──────────────────────── */

export function CommandTopRepsWidget() {
  const { period } = useCommandDashboard();
  const dash = useCommandAnalytics();
  const list = dash.leaderboard.data ?? [];
  const max = Math.max(1, ...list.map((x: any) => num(x.period_submitted) || num(x.alltime_submitted)));

  return (
    <WidgetShell>
      <WidgetHeading title="Top reps" hint={`Submissions · ${period.label}`} />
      <div className="min-h-0 flex-1 overflow-auto">
        {dash.leaderboard.isLoading ? (
          <WidgetLoading />
        ) : dash.leaderboard.isError ? (
          <WidgetError />
        ) : (
          <ul className="space-y-2.5">
            {list.slice(0, 8).map((r: any, i: number) => {
              const bar = ((num(r.period_submitted) || num(r.alltime_submitted)) / max) * 100;
              return (
                <li key={r.agent_id} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {r.agent_name}
                        {r.avg_load_mins != null && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            ~{fmtMins(num(r.avg_load_mins))}/app
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {num(r.period_submitted)}
                        <span className="ml-1 text-[10px] opacity-60">/ {num(r.alltime_submitted)} all-time</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-platinum" style={{ width: `${bar}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="text-xs text-muted-foreground">No rep-attributed submissions in this period.</li>
            )}
          </ul>
        )}
      </div>
    </WidgetShell>
  );
}

/* ── Daily decisions mini-chart (lum_analytics_daily) ─────────────────────────── */

export function CommandDecisionsWidget() {
  const dash = useCommandAnalytics();
  return (
    <WidgetShell>
      <WidgetHeading title="Decisions · last 14 days" hint="Approved vs declined per day (SAST)." />
      <ChartArea>
        {dash.daily.isLoading ? (
          <WidgetLoading />
        ) : dash.daily.isError ? (
          <WidgetError />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dash.daily.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 10 }}
                tickFormatter={(d: string) => String(d).slice(8)}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="approved" stackId="d" fill="hsl(var(--platinum))" />
              <Bar dataKey="declined" stackId="d" fill="hsl(0 70% 55%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartArea>
    </WidgetShell>
  );
}

/* ── Deal Desk backlog tiles (awaiting finalize + NATIS due) ──────────────────── */

export function AwaitingFinalizeWidget() {
  const { data, isLoading, isError } = useDealDeskList();
  if (isLoading) return <KpiSkeleton />;
  if (isError) return <WidgetError />;
  const count = (data ?? []).filter(isAwaitingFinalize).length;
  return (
    <Clickable to={ADMIN_ROUTES.dealDesk}>
      <KpiBody
        label="Awaiting Finalize"
        value={<span className={count > 0 ? 'text-amber-400' : 'text-emerald-400'}>{fmtN(count)}</span>}
        sub="Contract-signed drafts · current backlog"
        icon={ClipboardList}
        color="text-amber-400"
      />
    </Clickable>
  );
}

export function NatisDueWidget() {
  const deals = useDealDeskList();
  const settings = useDeskSettings();
  if (deals.isLoading || settings.isLoading) return <KpiSkeleton />;
  if (deals.isError || settings.isError) return <WidgetError />;

  let dueSoon = 0;
  let expired = 0;
  for (const d of deals.data ?? []) {
    const status = natisStatus(d, settings.data);
    if (!isNatisAttention(status, settings.data)) continue;
    if (status.expired) expired += 1;
    else dueSoon += 1;
  }
  const total = dueSoon + expired;
  const tone = expired > 0 ? 'text-red-400' : total > 0 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <Clickable to={ADMIN_ROUTES.dealDesk}>
      <KpiBody
        label="NATIS Due Soon"
        value={<span className={tone}>{fmtN(total)}</span>}
        sub={
          total === 0
            ? 'Nothing inside the warn window'
            : `${fmtN(dueSoon)} due soon · ${fmtN(expired)} expired`
        }
        icon={AlertTriangle}
        color={tone}
      />
    </Clickable>
  );
}
