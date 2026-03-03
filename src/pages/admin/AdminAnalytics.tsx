import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Target, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { startOfMonth, subMonths, format, parseISO } from "date-fns";
import { Helmet } from "react-helmet-async";

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

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      const [{ data: leads }, { data: deals }] = await Promise.all([
        supabase.from("leads").select("id, pipeline_stage, created_at, is_archived"),
        supabase.from("deal_records").select("*"),
      ]);

      if (leads && deals) {
        // KPI calculations
        const active = leads.filter(l => !l.is_archived && l.pipeline_stage !== 'cold').length;
        const conversion = leads.length > 0 ? (deals.length / leads.length) * 100 : 0;

        let profit = 0;
        deals.forEach(deal => {
          // Use the master formula columns from deal_records
          const grossProfit = Number(deal.gross_profit || 0);
          const dic = Number(deal.dic_amount || 0);
          const referralIncome = Number(deal.referral_income_amount || 0);
          profit += grossProfit + dic + referralIncome;
        });

        setStats({
          totalLeads: leads.length,
          activeLeads: active,
          totalDeals: deals.length,
          conversionRate: conversion,
          totalProfit: profit,
        });

        // Pipeline chart
        const stages = [
          { id: 'new', label: 'NEW' },
          { id: 'contacted', label: 'CONTACTED' },
          { id: 'finance', label: 'FINANCE' },
          { id: 'approved', label: 'APPROVED' },
          { id: 'cold', label: 'COLD' },
        ];
        setPipelineData(
          stages.map(s => ({
            name: s.label,
            count: leads.filter(l => l.pipeline_stage === s.id).length,
          }))
        );

        // Revenue trend (last 6 months)
        const last6 = Array.from({ length: 6 }).map((_, i) => {
          const d = subMonths(new Date(), i);
          return { month: format(d, "MMM yy"), rawDate: startOfMonth(d), profit: 0, deals: 0 };
        }).reverse();

        deals.forEach(deal => {
          if (!deal.created_at) return;
          const dealMonth = startOfMonth(parseISO(deal.created_at));
          const bucket = last6.find(m => m.rawDate.getTime() === dealMonth.getTime());
          if (bucket) {
            bucket.profit += Number(deal.gross_profit || 0) + Number(deal.dic_amount || 0);
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
    { label: "Deals Closed", value: stats.totalDeals.toString(), sub: "All-time delivered vehicles", icon: Target, color: "text-emerald-400" },
    { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%`, sub: "Leads → Deals ratio", icon: TrendingUp, color: "text-amber-400" },
    { label: "Gross Profit", value: `R ${stats.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "All-time gross revenue", icon: DollarSign, color: "text-green-400" },
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
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
