import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { sourceLabel } from '@/lib/pipelinev2/source';
import { PIPELINE_TABS, resolveStatusTab } from '@/lib/pipelinev2/tabs';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import {
  WidgetShell,
  WidgetHeading,
  ChartArea,
  WidgetLoading,
  WidgetError,
  TOOLTIP_STYLE,
} from './shared';

/**
 * All three new widgets (credit-check split, source breakdown, lane counts) read
 * the SAME three columns off finance_applications. We fetch them once, paginated
 * past PostgREST's 1000-row cap, and derive each widget client-side so the numbers
 * stay consistent and the DB is hit once (deduped by query key).
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

// ── Credit-check pass / fail / pending ──────────────────────────────────────────
const CREDIT_COLORS = {
  passed: 'hsl(160 70% 45%)',
  failed: 'hsl(0 70% 55%)',
  pending: 'hsl(38 92% 50%)',
} as const;

export function CreditCheckPassFailWidget() {
  const { data, isLoading, isError } = useAppFields();
  const counts = useMemo(() => {
    const c = { passed: 0, failed: 0, pending: 0, notRun: 0 };
    for (const r of data ?? []) {
      const s = r.credit_check_status;
      if (s === 'passed') c.passed++;
      else if (s === 'failed') c.failed++;
      else if (s === 'pending') c.pending++;
      else c.notRun++;
    }
    return c;
  }, [data]);

  if (isLoading) return <WidgetLoading />;
  if (isError) return <WidgetError />;

  const decided = counts.passed + counts.failed + counts.pending;
  const pie = [
    { name: 'Passed', value: counts.passed, fill: CREDIT_COLORS.passed },
    { name: 'Failed', value: counts.failed, fill: CREDIT_COLORS.failed },
    { name: 'Pending', value: counts.pending, fill: CREDIT_COLORS.pending },
  ].filter((d) => d.value > 0);

  return (
    <WidgetShell>
      <WidgetHeading title="Credit checks" hint="Pass / fail / pending of applications run." />
      <div className="grid grid-cols-3 gap-2 shrink-0">
        <Stat label="Passed" value={counts.passed} color="text-emerald-400" />
        <Stat label="Failed" value={counts.failed} color="text-red-400" />
        <Stat label="Pending" value={counts.pending} color="text-amber-400" />
      </div>
      <ChartArea>
        {decided > 0 ? (
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
            No credit checks run yet
          </div>
        )}
      </ChartArea>
      <p className="mt-1 shrink-0 text-[11px] text-muted-foreground">
        {counts.notRun.toLocaleString()} not yet checked
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
