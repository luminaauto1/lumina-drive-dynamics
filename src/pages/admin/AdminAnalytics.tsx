import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Target, Loader2, Inbox, Send, CheckCircle2, XCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { startOfMonth, subMonths, format, parseISO } from "date-fns";
import { Helmet } from "react-helmet-async";
import { isFinalizedDeal, dealNetProfit, dealReportDate } from "@/lib/dealMetrics";
import { useAnalyticsDashboard, type RangeKey } from "@/hooks/useAnalyticsDashboard";
import { AnalyticsRangeFilter } from "@/components/admin/AnalyticsRangeFilter";

const num = (v: any) => (v == null ? 0 : Number(v) || 0);
const fmtMins = (m: number | null) =>
  m == null ? "—" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;

const PeriodKpi = ({ label, value, icon: Icon, accent }: { label: string; value: any; icon: any; accent: string }) => (
  <Card className="p-4 bg-card border-border">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Icon className={`w-4 h-4 ${accent}`} />
    </div>
    <div className="mt-1 text-3xl font-bold tabular-nums">{num(value)}</div>
  </Card>
);

const RateCard = ({ label, pct, allTime, hint }: { label: string; pct: any; allTime?: any; hint: string }) => (
  <Card className="p-4 bg-card border-border">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {allTime != null && <span className="text-[10px] text-muted-foreground">all-time {num(allTime)}%</span>}
    </div>
    <div className="mt-1 text-3xl font-bold tabular-nums">{num(pct)}%</div>
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-platinum" style={{ width: `${Math.min(100, num(pct))}%` }} />
    </div>
    <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
  </Card>
);

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeLeads: 0,
    totalDeals: 0,
    conversionRate: 0,
    totalProfit: 0,
  });
  const [pipelineData, setPipelineData] = useState<{ name: string; count: number }[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<{ month: string; profit: number; deals: number }[]>([]);
  // ZTC-style finance-pipeline activity dashboard (additive; reads finance_applications RPCs).
  const [range, setRange] = useState<{ key: RangeKey; from?: string; to?: string }>({ key: 'today' });
  const dash = useAnalyticsDashboard(range);


  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      const stages = [
        { id: 'new', label: 'NEW' },
        { id: 'contacted', label: 'CONTACTED' },
        { id: 'finance', label: 'FINANCE' },
        { id: 'approved', label: 'APPROVED' },
        { id: 'cold', label: 'COLD' },
      ];

      // Use exact COUNT queries (head:true) for lead totals. PostgREST caps the
      // number of returned ROWS at 1000 server-side, so fetching rows and counting
      // would silently truncate (the dealership already has >1000 leads). Counts
      // are not subject to that cap.
      const [
        { count: totalLeads },
        { count: activeLeads },
        { data: deals },
        ...stageResults
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true })
          .not("is_archived", "is", true)
          .or("pipeline_stage.neq.cold,pipeline_stage.is.null"),
        supabase.from("deal_records").select("*").limit(20000),
        ...stages.map(s =>
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("pipeline_stage", s.id)
        ),
      ]);

      if (deals) {
        // Only finalized deals (with a sale date / closed) count toward money figures.
        const finalizedDeals = deals.filter(isFinalizedDeal);
        const leadTotal = totalLeads || 0;
        const conversion = leadTotal > 0 ? (finalizedDeals.length / leadTotal) * 100 : 0;

        // Net profit = the stored gross_profit column. It is ALREADY net of all
        // costs and already includes DIC + referral income — never add them again.
        const profit = finalizedDeals.reduce((sum, deal) => sum + dealNetProfit(deal), 0);

        setStats({
          totalLeads: leadTotal,
          activeLeads: activeLeads || 0,
          totalDeals: finalizedDeals.length,
          conversionRate: conversion,
          totalProfit: profit,
        });

        // Pipeline chart — per-stage exact counts (not truncated).
        setPipelineData(
          stages.map((s, i) => ({
            name: s.label,
            count: stageResults[i]?.count || 0,
          }))
        );

        // Revenue trend (last 6 months)
        const last6 = Array.from({ length: 6 }).map((_, i) => {
          const d = subMonths(new Date(), i);
          return { month: format(d, "MMM yy"), rawDate: startOfMonth(d), profit: 0, deals: 0 };
        }).reverse();

        finalizedDeals.forEach(deal => {
          const reportDate = dealReportDate(deal);
          if (!reportDate) return;
          const dealMonth = startOfMonth(parseISO(reportDate));
          const bucket = last6.find(m => m.rawDate.getTime() === dealMonth.getTime());
          if (bucket) {
            bucket.profit += dealNetProfit(deal);
            bucket.deals += 1;
          }
        });

        setRevenueTrend(last6.map(({ month, profit, deals: d }) => ({ month, profit, deals: d })));
      }

      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const kpis = [
    { label: "Total Leads", value: stats.totalLeads.toString(), sub: `${stats.activeLeads} currently active`, icon: Users, color: "text-blue-400" },
    { label: "Deals Closed", value: stats.totalDeals.toString(), sub: "All-time finalized deals", icon: Target, color: "text-emerald-400" },
    { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%`, sub: "Finalized deals ÷ total leads", icon: TrendingUp, color: "text-amber-400" },
    { label: "Net Profit", value: `R ${stats.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "All-time net (after costs & splits)", icon: DollarSign, color: "text-green-400" },
  ];

  return (
    <AdminLayout>
      <Helmet>
        <title>Analytics | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6 space-y-8">
        <h1 className="text-2xl font-semibold">Analytics</h1>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <Card key={k.label} className="p-5 bg-card border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{k.label}</span>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <p className="text-2xl font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline */}
          <Card className="p-5 bg-card border-border">
            <h3 className="text-base font-semibold mb-4">Pipeline Spread</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Revenue Trend */}
          <Card className="p-5 bg-card border-border">
            <h3 className="text-base font-semibold mb-4">6-Month Revenue Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={val => `R${val / 1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => [`R ${v.toLocaleString()}`, "Profit"]} />
                  <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── Finance pipeline activity (ZTC-style, additive) ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Finance pipeline activity · {dash.range.label}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live · refreshes every minute
              </span>
            </div>
            <AnalyticsRangeFilter value={range} onChange={setRange} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PeriodKpi label="Received" value={dash.kpis.data?.received} icon={Inbox} accent="text-foreground" />
            <PeriodKpi label="Submitted" value={dash.kpis.data?.submitted} icon={Send} accent="text-platinum" />
            <PeriodKpi label="Approved" value={dash.kpis.data?.approved} icon={CheckCircle2} accent="text-emerald-400" />
            <PeriodKpi label="Declined" value={dash.kpis.data?.declined} icon={XCircle} accent="text-red-400" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <RateCard label="Approval rate" pct={dash.kpis.data?.approval_rate} allTime={dash.kpis.data?.alltime_approval_rate} hint="approved of decided" />
            <RateCard label="Submission rate" pct={dash.kpis.data?.submit_rate} hint="submitted of received" />
            <RateCard label="Decline rate" pct={dash.kpis.data?.decline_rate} hint="declined of decided" />
            <Card className="p-4 bg-card border-border">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg working-time / app</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{fmtMins(dash.kpis.data?.avg_minutes_per_app ?? null)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {dash.kpis.data?.submitted
                  ? `${num(dash.kpis.data.submitted)} submitted over ${fmtMins(num(dash.kpis.data.working_minutes))} of work (8h day, Mon–Fri, −1h lunch)`
                  : 'No applications submitted in this period'}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="p-5 bg-card border-border lg:col-span-3">
              <h3 className="text-base font-semibold mb-1">Decisions · last 14 days</h3>
              <p className="text-[11px] text-muted-foreground mb-3">Approved vs declined per day (SAST).</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dash.daily.data ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={(d: string) => String(d).slice(8)} />
                    <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                    <Bar dataKey="approved" stackId="d" fill="hsl(var(--platinum))" />
                    <Bar dataKey="declined" stackId="d" fill="hsl(0 70% 55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 bg-card border-border lg:col-span-2">
              <h3 className="text-base font-semibold mb-1">Top reps · {dash.range.label}</h3>
              <p className="text-[11px] text-muted-foreground mb-3">Submissions this period · all-time alongside · ~time/app = avg load.</p>
              <ul className="space-y-2.5">
                {(dash.leaderboard.data ?? []).slice(0, 8).map((r: any, i: number) => {
                  const list = dash.leaderboard.data ?? [];
                  const max = Math.max(1, ...list.map((x: any) => num(x.period_submitted) || num(x.alltime_submitted)));
                  const bar = ((num(r.period_submitted) || num(r.alltime_submitted)) / max) * 100;
                  return (
                    <li key={r.agent_id} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {r.agent_name}
                            {r.avg_load_mins != null && <span className="ml-2 text-[10px] text-muted-foreground">~{fmtMins(num(r.avg_load_mins))}/app</span>}
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
                {(dash.leaderboard.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">No rep-attributed submissions yet.</li>}
              </ul>
              {dash.snapshot.data?.self_submitted ? (
                <p className="mt-3 text-[11px] text-muted-foreground">+ {num(dash.snapshot.data.self_submitted)} self-submitted, all-time (no rep).</p>
              ) : null}
            </Card>
          </div>
        </section>

      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
