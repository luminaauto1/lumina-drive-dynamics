import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, TrendingUp, AlertCircle, Car, DollarSign, Calculator, Search, MessageCircle, UserPlus, FileCheck2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Helmet } from "react-helmet-async";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    luminaNetProfit: 0,
    totalTurnover: 0,
    unitsDelivered: 0,
    target: 10,
    avgProfitPerUnit: 0,
  });
  const [urgentLeads, setUrgentLeads] = useState<any[]>([]);
  const [activityToday, setActivityToday] = useState({ messages: 0, leads: 0, apps: 0 });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      const now = new Date();
      const start = startOfMonth(now).toISOString();
      const end = endOfMonth(now).toISOString();

      // 1. Settings
      const { data: settings } = await supabase
        .from("site_settings")
        .select("*")
        .single();
      const monthlyTarget = (settings as any)?.monthly_sales_target || 10;

      // 2. Monthly Deals
      const { data: deals } = await supabase
        .from("deal_records")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end);

      let totalMetalProfit = 0;
      let totalExtrasProfit = 0;
      let totalTurnover = 0;

      (deals || []).forEach((deal: any) => {
        const sellPrice = Number(deal.sold_price || 0);
        const metalProfit =
          sellPrice -
          Number(deal.cost_price || 0) -
          Number(deal.recon_cost || 0);
        totalMetalProfit += metalProfit;

        let extras =
          Number(deal.dic_amount || 0) +
          Number(deal.external_admin_fee || 0) +
          Number(deal.referral_income_amount || 0);

        const addons = deal.addons_data || [];
        addons.forEach((a: any) => {
          extras += Number(a.selling_price || 0) - Number(a.cost_price || 0);
        });
        totalExtrasProfit += extras;
        totalTurnover += sellPrice;
      });

      const units = deals?.length || 0;
      const target = monthlyTarget;
      const luminaNet = (totalMetalProfit * 0.60) + totalExtrasProfit;

      setMetrics({
        luminaNetProfit: luminaNet,
        totalTurnover,
        unitsDelivered: units,
        target,
        avgProfitPerUnit: units > 0 ? luminaNet / units : 0,
      });

      // 3. Pipeline Health
      const { data: activeLeads } = await supabase
        .from("leads")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (activeLeads) {
        // Priority order (higher = more urgent / overrides)
        const STAGE_PRIORITY: Record<string, number> = {
          validation_pending: 100,
          new: 50,
        };

        const urgent = activeLeads.filter(
          (l) =>
            l.pipeline_stage === "new" ||
            l.pipeline_stage === "validation_pending"
        );

        // Deduplicate by email/phone — keep highest-priority, most-recent record per client
        const dedupeMap = new Map<string, any>();
        urgent.forEach((l) => {
          const key =
            (l.client_email && l.client_email.toLowerCase().trim()) ||
            (l.client_phone && l.client_phone.replace(/\D/g, "")) ||
            `id:${l.id}`;
          const existing = dedupeMap.get(key);
          if (!existing) {
            dedupeMap.set(key, l);
            return;
          }
          const existingP = STAGE_PRIORITY[existing.pipeline_stage] || 0;
          const incomingP = STAGE_PRIORITY[l.pipeline_stage] || 0;
          if (
            incomingP > existingP ||
            (incomingP === existingP &&
              new Date(l.created_at).getTime() >
                new Date(existing.created_at).getTime())
          ) {
            dedupeMap.set(key, l);
          }
        });

        const deduped = Array.from(dedupeMap.values()).sort((a, b) => {
          const pa = STAGE_PRIORITY[a.pipeline_stage] || 0;
          const pb = STAGE_PRIORITY[b.pipeline_stage] || 0;
          if (pb !== pa) return pb - pa;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setUrgentLeads(deduped.slice(0, 6));
      }

      // 4. Today's communication activity (messages / leads / apps)
      const dayStart = startOfDay(now).toISOString();
      const dayEnd = endOfDay(now).toISOString();
      const [{ count: msgToday }, { count: leadsToday }, { count: appsToday }] = await Promise.all([
        supabase.from("whatsapp_messages").select("id", { count: "exact", head: true })
          .gte("created_at", dayStart).lte("created_at", dayEnd),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dayStart).lte("created_at", dayEnd),
        supabase.from("finance_applications").select("id", { count: "exact", head: true })
          .gte("created_at", dayStart).lte("created_at", dayEnd),
      ]);
      setActivityToday({
        messages: msgToday ?? 0,
        leads: leadsToday ?? 0,
        apps: appsToday ?? 0,
      });

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const fmt = (val: number) =>
    `R ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          Loading Command Center…
        </div>
      </AdminLayout>
    );
  }

  const progressPercent = Math.min(
    (metrics.unitsDelivered / metrics.target) * 100,
    100
  );

  return (
    <AdminLayout>
      <Helmet>
        <title>Command Center | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6 space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Command Center</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "MMMM yyyy")} Overview
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/quotes")}>
              <Calculator className="w-4 h-4 mr-2" />
              Quick Quote
            </Button>
            <Button size="sm" onClick={() => navigate("/admin/leads")}>
              <Search className="w-4 h-4 mr-2" />
              Pipeline
            </Button>
          </div>
        </div>

        {/* FINANCIAL INTELLIGENCE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Your Net Profit */}
          <Card className="p-5 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium text-muted-foreground">
                Your Net Profit
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {fmt(metrics.luminaNetProfit)}
            </p>
            <p className="text-xs text-muted-foreground">
              Lumina's Final Cut (After Split)
            </p>
          </Card>

          {/* Total Turnover */}
          <Card className="p-5 space-y-1">
            <div className="flex items-center gap-2 text-blue-400">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium text-muted-foreground">
                Total Trading Turnover
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {fmt(metrics.totalTurnover)}
            </p>
            <p className="text-xs text-muted-foreground">
              Top-Line Revenue (Vehicle Value)
            </p>
          </Card>

          {/* Units */}
          <Card className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-purple-400">
              <Car className="w-5 h-5" />
              <span className="text-sm font-medium text-muted-foreground">
                Units Delivered
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-purple-400">
                {metrics.unitsDelivered}
              </span>
              <span className="text-sm text-muted-foreground mb-0.5">
                / {metrics.target} Target
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </Card>

          {/* Avg Yield */}
          <Card className="p-5 space-y-1">
            <div className="flex items-center gap-2 text-amber-400">
              <Calculator className="w-5 h-5" />
              <span className="text-sm font-medium text-muted-foreground">
                Avg Yield Per Unit
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {fmt(metrics.avgProfitPerUnit)}
            </p>
            <p className="text-xs text-muted-foreground">
              Your Net / Units Sold
            </p>
          </Card>
        </div>

        {/* ACTION MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Urgent */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <h2 className="font-semibold">
                  Requires Action ({urgentLeads.length})
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/leads")}
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {urgentLeads.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                Inbox Zero. All leads actioned. ✅
              </p>
            ) : (
              <div className="space-y-2">
                {urgentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => navigate("/admin/leads")}
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {lead.client_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.client_phone || "No phone"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                        {(lead.pipeline_stage || "new").replace(/_/g, " ")}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Lead & Communication Activity (Today) */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold">Lead &amp; Communication Activity</h2>
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Today</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => navigate("/admin/lead-analytics")}
                className="text-left p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
              >
                <div className="flex items-center gap-2 mb-2 text-emerald-400">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Messages</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{activityToday.messages.toLocaleString()}</p>
              </button>

              <button
                onClick={() => navigate("/admin/leads")}
                className="text-left p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
              >
                <div className="flex items-center gap-2 mb-2 text-blue-400">
                  <UserPlus className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">New Leads</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{activityToday.leads.toLocaleString()}</p>
              </button>

              <button
                onClick={() => navigate("/admin/finance")}
                className="text-left p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
              >
                <div className="flex items-center gap-2 mb-2 text-amber-400">
                  <FileCheck2 className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Finance Apps</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{activityToday.apps.toLocaleString()}</p>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span>Top-of-funnel volume from WhatsApp + web</span>
              <button
                onClick={() => navigate("/admin/lead-analytics")}
                className="text-foreground hover:text-emerald-400 transition-colors inline-flex items-center"
              >
                Full analytics <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
