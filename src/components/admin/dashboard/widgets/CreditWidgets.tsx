import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { sourceLabel } from '@/lib/pipelinev2/source';
import { PIPELINE_TABS, resolveStatusTab } from '@/lib/pipelinev2/tabs';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { computeRange } from '@/hooks/useAnalyticsDashboard';
import { useDashboardRange } from './DashboardContext';
import {
  WidgetShell,
  WidgetHeading,
  ChartArea,
  WidgetLoading,
  WidgetError,
  TOOLTIP_STYLE,
} from './shared';

/**
 * The source-breakdown + lane-counts widgets read the SAME two columns off
 * finance_applications. We fetch them once, paginated past PostgREST's 1000-row
 * cap, and derive each widget client-side so the numbers stay consistent and the
 * DB is hit once (deduped by query key).
 *
 * The credit-check widget is period-scoped (it filters by
 * credit_check_first_checked_at against the shared dashboard range), so it runs
 * its own cheap COUNT queries instead — see useCreditCounts below.
 */
interface AppField {
  submission_source: string | null;
  status: string | null;
  credit_check_status: string | null;
}

async function fetchAppFields(): Promise<AppField[]> {
  const PAGE = 1000;
  const rows: AppField[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('finance_applications')
      .select('submission_source, status, credit_check_status')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as AppField[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

function useAppFields() {
  return useQuery({ queryKey: ['dashboard-app-fields'], queryFn: fetchAppFields, staleTime: 60_000 });
}

// ── Credit-check pass / fail (period-scoped) ────────────────────────────────────
// Passed/Failed are counted by COMPLETION date (credit_check_first_checked_at) so
// the widget answers "how many checks got an outcome in the selected period" — it
// reads 0/0 on a day none happened. Pending / not-yet-run have no completion
// timestamp (they're a live backlog), so they're shown as CURRENT totals, not
// period-scoped.
const CREDIT_COLORS = {
  passed: 'hsl(160 70% 45%)',
  failed: 'hsl(0 70% 55%)',
} as const;

export interface CreditCounts {
  /** passed with a completion stamp inside [since, until) */
  passed: number;
  /** failed with a completion stamp inside [since, until) */
  failed: number;
  /** current backlog awaiting an outcome (all-time, not period-scoped) */
  pendingNow: number;
  /** current backlog never run (all-time, not period-scoped) */
  notRunNow: number;
}

/** Exported for the Command Center's period-scoped credit widget. */
export async function fetchCreditCounts(since: string, until: string): Promise<CreditCounts> {
  const table = () => supabase.from('finance_applications');
  // Cheap HEAD count queries (no rows returned) — sidesteps the 1000-row cap
  // entirely. Passed/Failed are scoped to the completion window; the two backlog
  // counts are intentionally unscoped current totals.
  const [passed, failed, pendingNow, notRunNow] = await Promise.all([
    table()
      .select('*', { count: 'exact', head: true })
      .eq('credit_check_status', 'passed')
      .gte('credit_check_first_checked_at', since)
      .lt('credit_check_first_checked_at', until),
    table()
      .select('*', { count: 'exact', head: true })
      .eq('credit_check_status', 'failed')
      .gte('credit_check_first_checked_at', since)
      .lt('credit_check_first_checked_at', until),
    table().select('*', { count: 'exact', head: true }).eq('credit_check_status', 'pending'),
    table().select('*', { count: 'exact', head: true }).is('credit_check_status', null),
  ]);
  for (const r of [passed, failed, pendingNow, notRunNow]) {
    if (r.error) throw r.error;
  }
  return {
    passed: passed.count ?? 0,
    failed: failed.count ?? 0,
    pendingNow: pendingNow.count ?? 0,
    notRunNow: notRunNow.count ?? 0,
  };
}

function useCreditCounts() {
  const { range } = useDashboardRange();
  // Reuse the SAME range→timestamp helper the finance widgets use so the credit
  // widget shares the exact date filter (SAST-aware [since, until) window).
  const r = computeRange(range.key, range.from, range.to);
  const since = r.since.toISOString();
  const until = r.until.toISOString();
  const query = useQuery({
    // Key on the range so it refetches whenever the shared range changes.
    queryKey: ['dashboard-credit-counts', range.key, range.from ?? '', range.to ?? ''],
    queryFn: () => fetchCreditCounts(since, until),
    staleTime: 60_000,
  });
  return { query, label: r.label };
}

export function CreditCheckPassFailWidget() {
  const { query, label } = useCreditCounts();
  const { data, isLoading, isError } = query;

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
      <WidgetHeading title="Credit checks" hint={`Completed in the selected period · ${label}`} />
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <Stat label="Passed" value={passed} color="text-emerald-400" />
        <Stat label="Failed" value={failed} color="text-red-400" />
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

// ── Submission-source breakdown ─────────────────────────────────────────────────
export function SourceBreakdownWidget() {
  const { data, isLoading, isError } = useAppFields();
  const rows = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of data ?? []) {
      const label = sourceLabel(r.submission_source);
      tally.set(label, (tally.get(label) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (isLoading) return <WidgetLoading />;
  if (isError) return <WidgetError />;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <WidgetShell>
      <WidgetHeading title="Applications by source" hint="Where finance applications came from." />
      <div className="min-h-0 flex-1 overflow-auto">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm text-foreground">{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-platinum" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {r.count.toLocaleString()}
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-xs text-muted-foreground">No applications yet.</li>}
        </ul>
      </div>
    </WidgetShell>
  );
}

// ── Pipeline v2 lane counts ─────────────────────────────────────────────────────
export function LaneCountsWidget() {
  const { data, isLoading, isError } = useAppFields();
  // Bucket with the SAME editable per-slug lane routing the Pipeline v2 page uses
  // (status_overrides.lane via useStatusConfig), so lane counts here match the
  // live pipeline column counts instead of the hardcoded statusToTab default.
  const { financeLaneOverrides } = useStatusConfig();
  const rows = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of data ?? []) {
      const tab = resolveStatusTab(r.status, financeLaneOverrides);
      tally.set(tab, (tally.get(tab) ?? 0) + 1);
    }
    // Registry order (excluding the 'all' pseudo-tab), only lanes with content.
    return PIPELINE_TABS.filter((t) => t.key !== 'all').map((t) => ({
      key: t.key,
      label: t.label,
      accent: t.accent,
      count: tally.get(t.key) ?? 0,
    }));
  }, [data, financeLaneOverrides]);

  if (isLoading) return <WidgetLoading />;
  if (isError) return <WidgetError />;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <WidgetShell>
      <WidgetHeading title="Applications by lane" hint="Pipeline v2 lane distribution." />
      <div className="min-h-0 flex-1 overflow-auto">
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3">
              <span className={`w-28 shrink-0 truncate text-sm ${r.accent}`}>{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-platinum" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {r.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
}
