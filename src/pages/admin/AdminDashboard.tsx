import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, TrendingUp, AlertCircle, Car, DollarSign, Calculator, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Helmet } from "react-helmet-async";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    retainedIncome: 0,
    sharedProfit: 0,
    unitsDelivered: 0,
    target: 10,
    avgProfitPerUnit: 0,
  });
  const [urgentLeads, setUrgentLeads] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

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

      let retained = 0;
      let shared = 0;

      (deals || []).forEach((deal: any) => {
        // Retained (Pure Money): DIC + Admin Fee + Referral Income + Addons profit
        retained +=
          Number(deal.dic_amount || 0) +
          Number(deal.external_admin_fee || 0) +
          Number(deal.referral_income_amount || 0);

        // Add addons profit (VAPS)
        const addons = deal.addons_data || [];
        addons.forEach((a: any) => {
          retained += Number(a.selling_price || 0) - Number(a.cost_price || 0);
        });

        // Shared Metal Profit: Sold - Cost - Recon
        shared +=
          Number(deal.sold_price || 0) -
          Number(deal.cost_price || 0) -
          Number(deal.recon_cost || 0);
      });

      const units = deals?.length || 0;
      const target = monthlyTarget;

      setMetrics({
        retainedIncome: retained,
        sharedProfit: shared,
        unitsDelivered: units,
        target,
        avgProfitPerUnit: units > 0 ? (retained + shared) / units : 0,
      });

      // 3. Pipeline Health
      const { data: activeLeads } = await supabase
        .from("leads")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (activeLeads) {
        setUrgentLeads(
          activeLeads
            .filter(
              (l) =>
                l.pipeline_stage === "new" ||
                l.pipeline_stage === "validation_pending"
            )
            .slice(0, 6)
        );
        setDeliveries(
          activeLeads
            .filter((l) => l.pipeline_stage === "prepping_delivery")
            .slice(0, 6)
        );
      }

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
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/quote")}>
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
          {/* Retained */}
          <Card className="p-5 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium text-muted-foreground">
                Lumina Retained Income
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {fmt(metrics.retainedIncome)}
            </p>
            <p className="text-xs text-muted-foreground">
              100% Yours (VAPS, DIC, Referrals)
            </p>
          </Card>

          {/* Shared */}
          <Card className="p-5 space-y-1">
            <div className="flex items-center gap-2 text-blue-400">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium text-muted-foreground">
                Shared Metal Profit
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {fmt(metrics.sharedProfit)}
            </p>
            <p className="text-xs text-muted-foreground">
              Distributable Pot (JV Split)
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
              Total Profit / Units Sold
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

          {/* Deliveries */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-green-400" />
                <h2 className="font-semibold">
                  Prepping For Delivery ({deliveries.length})
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
            {deliveries.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No vehicles currently in prep.
              </p>
            ) : (
              <div className="space-y-2">
                {deliveries.map((lead) => (
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
                        Awaiting Handover
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
