import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

// ── Shared formatting helpers (identical semantics to AdminAnalytics.tsx) ──────
export const num = (v: any) => (v == null ? 0 : Number(v) || 0);
export const fmtMins = (m: number | null) =>
  m == null ? '—' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;

/**
 * Widget bodies render inside DashboardGrid's card (which already supplies the
 * border + p-4). These helpers give a consistent inner layout WITHOUT adding
 * another Card/border wrapper.
 */
export function WidgetShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex h-full min-h-0 flex-col ${className}`}>{children}</div>;
}

export function WidgetHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 shrink-0">
      <h3 className="text-base font-semibold leading-tight">{title}</h3>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Fills the remaining space and constrains height so Recharts ResponsiveContainer measures correctly. */
export function ChartArea({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1">{children}</div>;
}

export function WidgetLoading() {
  return (
    <div className="flex h-full min-h-[80px] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function WidgetError({ message = 'Failed to load' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[80px] items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

// ── KPI tile body (no Card wrapper — grid supplies it) ─────────────────────────
export function KpiBody({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: any;
  color: string;
}) {
  return (
    <WidgetShell className="justify-between">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </WidgetShell>
  );
}

/** Period KPI (finance activity) — big number + subtle accent icon. */
export function PeriodKpiBody({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: any;
  icon: any;
  accent: string;
}) {
  return (
    <WidgetShell className="justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{num(value)}</div>
    </WidgetShell>
  );
}

/** Rate card body — percentage + progress bar + hint. */
export function RateBody({
  label,
  pct,
  allTime,
  hint,
}: {
  label: string;
  pct: any;
  allTime?: any;
  hint: string;
}) {
  return (
    <WidgetShell className="justify-center">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {allTime != null && <span className="text-[10px] text-muted-foreground">all-time {num(allTime)}%</span>}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{num(pct)}%</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-platinum" style={{ width: `${Math.min(100, num(pct))}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </WidgetShell>
  );
}

// Recharts tooltip style shared by every chart widget.
export const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
} as const;
