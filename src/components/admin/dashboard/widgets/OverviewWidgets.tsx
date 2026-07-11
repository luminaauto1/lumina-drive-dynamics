import { Users, TrendingUp, DollarSign, Target } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useOverviewData } from './useOverviewData';
import {
  KpiBody,
  WidgetShell,
  WidgetHeading,
  ChartArea,
  WidgetLoading,
  WidgetError,
  TOOLTIP_STYLE,
} from './shared';

// ── KPI tiles ──────────────────────────────────────────────────────────────────
export function TotalLeadsWidget() {
  const { data, isLoading, isError } = useOverviewData();
  if (isLoading) return <WidgetLoading />;
  if (isError || !data) return <WidgetError />;
  return (
    <KpiBody
      label="Total Leads"
      value={data.stats.totalLeads.toLocaleString()}
      sub={`${data.stats.activeLeads} currently active`}
      icon={Users}
      color="text-blue-400"
    />
  );
}

export function DealsClosedWidget() {
  const { data, isLoading, isError } = useOverviewData();
  if (isLoading) return <WidgetLoading />;
  if (isError || !data) return <WidgetError />;
  return (
    <KpiBody
      label="Deals Closed"
      value={data.stats.totalDeals.toLocaleString()}
      sub="All-time finalized deals"
      icon={Target}
      color="text-emerald-400"
    />
  );
}

export function ConversionRateWidget() {
  const { data, isLoading, isError } = useOverviewData();
  if (isLoading) return <WidgetLoading />;
  if (isError || !data) return <WidgetError />;
  return (
    <KpiBody
      label="Conversion Rate"
      value={`${data.stats.conversionRate.toFixed(1)}%`}
      sub="Finalized deals ÷ total leads"
      icon={TrendingUp}
      color="text-amber-400"
    />
  );
}

export function NetProfitWidget() {
  const { data, isLoading, isError } = useOverviewData();
  if (isLoading) return <WidgetLoading />;
  if (isError || !data) return <WidgetError />;
  return (
    <KpiBody
      label="Net Profit"
      value={`R ${data.stats.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      sub="All-time net (after costs & splits)"
      icon={DollarSign}
      color="text-green-400"
    />
  );
}

// ── Charts ───────────────────────────────────────────────────────────────────
export function PipelineSpreadWidget() {
  const { data, isLoading, isError } = useOverviewData();
  return (
    <WidgetShell>
      <WidgetHeading title="Pipeline Spread" hint="Leads per pipeline stage" />
      <ChartArea>
        {isLoading ? (
          <WidgetLoading />
        ) : isError || !data ? (
          <WidgetError />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartArea>
    </WidgetShell>
  );
}

export function RevenueTrendWidget() {
  const { data, isLoading, isError } = useOverviewData();
  return (
    <WidgetShell>
      <WidgetHeading title="6-Month Revenue Trend" hint="Net profit from finalized deals" />
      <ChartArea>
        {isLoading ? (
          <WidgetLoading />
        ) : isError || !data ? (
          <WidgetError />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(val) => `R${val / 1000}k`} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [`R ${v.toLocaleString()}`, 'Profit']}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartArea>
    </WidgetShell>
  );
}
