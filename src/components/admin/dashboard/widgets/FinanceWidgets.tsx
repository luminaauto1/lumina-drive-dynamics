import { Inbox, Send, CheckCircle2, XCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AnalyticsRangeFilter } from '@/components/admin/AnalyticsRangeFilter';
import { useDashboardRange, useFinanceDashboard } from './DashboardContext';
import {
  PeriodKpiBody,
  RateBody,
  WidgetShell,
  WidgetHeading,
  ChartArea,
  WidgetLoading,
  num,
  fmtMins,
  TOOLTIP_STYLE,
} from './shared';

// ── Shared date-range filter widget (drives every finance widget) ──────────────
export function FinanceRangeWidget() {
  const { range, setRange } = useDashboardRange();
  const dash = useFinanceDashboard();
  return (
    <WidgetShell className="justify-center gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Finance pipeline activity · {dash.range.label}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live · refreshes every minute
        </span>
      </div>
      <AnalyticsRangeFilter value={range} onChange={setRange} />
    </WidgetShell>
  );
}

// ── Period KPI tiles ───────────────────────────────────────────────────────────
export function FinanceReceivedWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return <PeriodKpiBody label="Received" value={dash.kpis.data?.received} icon={Inbox} accent="text-foreground" />;
}

export function FinanceSubmittedWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return <PeriodKpiBody label="Submitted" value={dash.kpis.data?.submitted} icon={Send} accent="text-platinum" />;
}

export function FinanceApprovedWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return (
    <PeriodKpiBody label="Approved" value={dash.kpis.data?.approved} icon={CheckCircle2} accent="text-emerald-400" />
  );
}

export function FinanceDeclinedWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return <PeriodKpiBody label="Declined" value={dash.kpis.data?.declined} icon={XCircle} accent="text-red-400" />;
}

// ── Rate cards ─────────────────────────────────────────────────────────────────
export function ApprovalRateWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return (
    <RateBody
      label="Approval rate"
      pct={dash.kpis.data?.approval_rate}
      allTime={dash.kpis.data?.alltime_approval_rate}
      hint="approved of decided"
    />
  );
}

export function SubmissionRateWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return <RateBody label="Submission rate" pct={dash.kpis.data?.submit_rate} hint="submitted of received" />;
}

export function DeclineRateWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  return <RateBody label="Decline rate" pct={dash.kpis.data?.decline_rate} hint="declined of decided" />;
}

export function AvgWorkingTimeWidget() {
  const dash = useFinanceDashboard();
  if (dash.kpis.isLoading) return <WidgetLoading />;
  const d = dash.kpis.data;
  return (
    <WidgetShell className="justify-center">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg working-time / app</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{fmtMins(d?.avg_minutes_per_app ?? null)}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {d?.submitted
          ? `${num(d.submitted)} submitted over ${fmtMins(num(d.working_minutes))} of work (8h day, Mon–Fri, −1h lunch)`
          : 'No applications submitted in this period'}
      </div>
    </WidgetShell>
  );
}

// ── Decisions (last 14 days) ────────────────────────────────────────────────────
export function DecisionsDailyWidget() {
  const dash = useFinanceDashboard();
  return (
    <WidgetShell>
      <WidgetHeading title="Decisions · last 14 days" hint="Approved vs declined per day (SAST)." />
      <ChartArea>
        {dash.daily.isLoading ? (
          <WidgetLoading />
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
              {/* Green = approved, red = declined (matches CreditWidgets' pass/fail
                  pair and the Command Center's copy of this chart). */}
              <Bar dataKey="approved" stackId="d" fill="hsl(160 70% 45%)" />
              <Bar dataKey="declined" stackId="d" fill="hsl(0 70% 55%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartArea>
    </WidgetShell>
  );
}

// ── Top reps leaderboard ─────────────────────────────────────────────────────────
export function TopRepsWidget() {
  const dash = useFinanceDashboard();
  const list = dash.leaderboard.data ?? [];
  const max = Math.max(1, ...list.map((x: any) => num(x.period_submitted) || num(x.alltime_submitted)));
  return (
    <WidgetShell>
      <WidgetHeading
        title={`Top reps · ${dash.range.label}`}
        hint="Submissions this period · all-time alongside · ~time/app = avg load."
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {dash.leaderboard.isLoading ? (
          <WidgetLoading />
        ) : (
          <>
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
                <li className="text-xs text-muted-foreground">No rep-attributed submissions yet.</li>
              )}
            </ul>
            {dash.snapshot.data?.self_submitted ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                + {num(dash.snapshot.data.self_submitted)} self-submitted, all-time (no rep).
              </p>
            ) : null}
          </>
        )}
      </div>
    </WidgetShell>
  );
}
