import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_ROUTES } from "@/lib/adminRoutes";
import {
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Car,
  DollarSign,
  Calculator,
  Search,
  BarChart3,
  UserPlus,
  FileCheck2,
  Activity,
  Sliders,
  GripVertical,
  RotateCcw,
  CheckCircle2,
  ClipboardCheck,
  Banknote,
  PackageCheck,
  Clock,
  Maximize2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { Helmet } from "react-helmet-async";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  isFinalizedDeal,
  dealNetProfit,
  dealReportDateObj,
} from "@/lib/dealMetrics";
import {
  useDashboardLayout,
  WIDGET_SPAN,
  type DashboardWidget,
  type WidgetSize,
} from "@/hooks/useDashboardLayout";

/* ───────────────────────── Period selector ───────────────────────── */

// "current" | "overall" | a YYYY-MM key for a specific previous month.
type PeriodKey = string;

interface PeriodOption {
  key: PeriodKey;
  label: string;
  /** null start = all-time ("Overall"). */
  start: Date | null;
  end: Date | null;
}

/** Build the period list: current month, the previous 11 months, then Overall. */
function buildPeriods(now: Date): PeriodOption[] {
  const opts: PeriodOption[] = [
    {
      key: "current",
      label: `${format(now, "MMMM yyyy")} (Current)`,
      start: startOfMonth(now),
      end: endOfMonth(now),
    },
  ];
  for (let i = 1; i <= 11; i++) {
    const d = subMonths(now, i);
    opts.push({
      key: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy"),
      start: startOfMonth(d),
      end: endOfMonth(d),
    });
  }
  opts.push({ key: "overall", label: "Overall (All-Time)", start: null, end: null });
  return opts;
}

/* ───────────────────────── KPI types ───────────────────────── */

interface PeriodMetrics {
  grossProfit: number;
  totalUnits: number;
  approvals: number;
  valuations: number;
  deposits: number;
  closedDeals: number;
  pendingApps: number;
  avgYield: number;
  turnover: number;
}

const EMPTY_METRICS: PeriodMetrics = {
  grossProfit: 0,
  totalUnits: 0,
  approvals: 0,
  valuations: 0,
  deposits: 0,
  closedDeals: 0,
  pendingApps: 0,
  avgYield: 0,
  turnover: 0,
};

// Statuses that represent a bank approval (pre-approved or bank-validated).
const APPROVED_STATUSES = new Set([
  "pre_approved",
  "approved",
  "validations_complete",
]);

// Statuses that represent an application still awaiting action.
const PENDING_STATUSES = new Set([
  "pending",
  "application_submitted",
  "ready_to_submit",
  "sent_to_banks",
  "documents_received",
  "validations_pending",
]);

const inPeriod = (raw: string | null | undefined, p: PeriodOption): boolean => {
  if (!p.start || !p.end) return true; // Overall
  if (!raw) return false;
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return dt >= p.start && dt <= p.end;
};

/* ───────────────────────── Sortable widget shell ───────────────────────── */

const SIZE_CYCLE: Record<WidgetSize, WidgetSize> = {
  small: "medium",
  medium: "large",
  large: "small",
};

interface SortableWidgetProps {
  widget: DashboardWidget;
  customizing: boolean;
  children: React.ReactNode;
  onToggleVisible: (id: string) => void;
  onCycleSize: (id: string) => void;
  label: string;
}

const SortableWidget = ({
  widget,
  customizing,
  children,
  onToggleVisible,
  onCycleSize,
  label,
}: SortableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !customizing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative col-span-1 sm:col-span-2 ${WIDGET_SPAN[widget.size]} ${
        isDragging ? "ring-2 ring-primary rounded-md" : ""
      }`}
    >
      {children}
      {customizing && (
        <div className="absolute inset-x-0 -top-2 flex items-center justify-end gap-1 px-1">
          <button
            type="button"
            onClick={() => onCycleSize(widget.id)}
            title={`Size: ${widget.size} — click to change`}
            className="rounded bg-secondary/90 p-1 text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onToggleVisible(widget.id)}
            title="Hide widget"
            aria-label={`Hide ${label}`}
            className="rounded bg-secondary/90 px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
          <div
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            className="cursor-grab rounded bg-secondary/90 p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Dashboard ───────────────────────── */

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);

  const periods = useMemo(() => buildPeriods(new Date()), []);
  const [periodKey, setPeriodKey] = useState<PeriodKey>("current");
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];

  // Raw datasets (fetched once; KPIs recompute client-side per period).
  const [deals, setDeals] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [valuationDates, setValuationDates] = useState<string[]>([]);
  const [target, setTarget] = useState(10);

  // "New apps today" is always today's count, independent of the period.
  const [newAppsToday, setNewAppsToday] = useState(0);

  const [urgentLeads, setUrgentLeads] = useState<any[]>([]);
  const [activityToday, setActivityToday] = useState({ totalVolume: 0, leads: 0, apps: 0 });

  const { widgets, toggleVisible, setSize, reorder, reset } = useDashboardLayout(user?.id);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      const now = new Date();

      const { data: settings } = await supabase
        .from("site_settings")
        .select("*")
        .single();
      setTarget((settings as any)?.monthly_sales_target || 10);

      // Deal records — keep the full finalized set; bucket per selected period below.
      const { data: dealRows } = await supabase
        .from("deal_records")
        .select("*")
        .limit(20000);
      setDeals(dealRows || []);

      // Finance applications — used for approvals / pending counts per period.
      const { data: appRows } = await supabase
        .from("finance_applications")
        .select("id, status, created_at, status_updated_at")
        .limit(20000);
      setApps(appRows || []);

      // Valuations done = sell-car (trade-in valuation) requests, bucketed by date.
      const { data: valRows } = await supabase
        .from("sell_car_requests")
        .select("created_at")
        .limit(20000);
      setValuationDates((valRows || []).map((r: any) => r.created_at));

      // "New apps today" — always today's finance applications, period-independent.
      const startOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const dayStart = startOfDayLocal.toISOString();
      const dayEnd = endOfDayLocal.toISOString();

      const { count: appsTodayCount } = await supabase
        .from("finance_applications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);
      setNewAppsToday(appsTodayCount ?? 0);

      // Pipeline health — urgent leads (unchanged behaviour).
      const { data: activeLeads } = await supabase
        .from("leads")
        .select("*")
        .eq("is_archived", false)
        .in("pipeline_stage", ["new", "validation_pending"])
        .order("created_at", { ascending: false })
        .limit(1000);

      if (activeLeads) {
        const STAGE_PRIORITY: Record<string, number> = {
          validation_pending: 100,
          new: 50,
        };
        const urgent = activeLeads.filter(
          (l) => l.pipeline_stage === "new" || l.pipeline_stage === "validation_pending",
        );
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
              new Date(l.created_at).getTime() > new Date(existing.created_at).getTime())
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

      // Today's top-of-funnel volume (unchanged behaviour).
      const [{ count: leadsToday }, { count: draftsToday }] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dayStart).lte("created_at", dayEnd),
        supabase.from("application_drafts").select("id", { count: "exact", head: true })
          .gte("updated_at", dayStart).lte("updated_at", dayEnd),
      ]);
      setActivityToday({
        totalVolume: (leadsToday ?? 0) + (draftsToday ?? 0),
        leads: leadsToday ?? 0,
        apps: appsTodayCount ?? 0,
      });

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  // Recompute all period-scoped KPIs whenever the period or raw data changes.
  const metrics: PeriodMetrics = useMemo(() => {
    if (!period) return EMPTY_METRICS;

    let grossProfit = 0;
    let turnover = 0;
    let totalUnits = 0;
    let deposits = 0;
    let closedDeals = 0;

    deals.forEach((deal: any) => {
      if (!isFinalizedDeal(deal)) return;
      const dt = dealReportDateObj(deal);
      const raw = dt ? format(dt, "yyyy-MM-dd") : null;
      if (!inPeriod(raw, period)) return;
      grossProfit += dealNetProfit(deal);
      turnover += Number(deal.sold_price || 0);
      totalUnits += 1;
      deposits += Number(deal.client_deposit || 0);
      if (deal.is_closed === true) closedDeals += 1;
    });

    let approvals = 0;
    let pendingApps = 0;
    apps.forEach((a: any) => {
      // Approvals are dated by status change (status_updated_at) when known so a
      // re-approval lands in the right month; new/pending dated by creation.
      const approvalDate = a.status_updated_at || a.created_at;
      if (APPROVED_STATUSES.has(a.status) && inPeriod(approvalDate, period)) approvals += 1;
      if (PENDING_STATUSES.has(a.status) && inPeriod(a.created_at, period)) pendingApps += 1;
    });

    const valuations = valuationDates.filter((d) => inPeriod(d, period)).length;

    return {
      grossProfit,
      turnover,
      totalUnits,
      deposits,
      closedDeals,
      approvals,
      pendingApps,
      valuations,
      avgYield: totalUnits > 0 ? grossProfit / totalUnits : 0,
    };
  }, [period, deals, apps, valuationDates]);

  const fmt = (val: number) =>
    `R ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const num = (val: number) => val.toLocaleString();

  // Static descriptor (label + how each widget renders) keyed by widget id.
  const WIDGET_DEFS: Record<
    string,
    { label: string; render: () => React.ReactNode }
  > = {
    gross_profit: {
      label: "Total GP",
      render: () => (
        <StatTile
          icon={<DollarSign className="text-emerald-400" />}
          label="Total GP"
          value={<span className="text-emerald-400">{fmt(metrics.grossProfit)}</span>}
          hint="Gross profit (after split)"
        />
      ),
    },
    total_units: {
      label: "Total Units",
      render: () => (
        <StatTile
          icon={<Car className="text-purple-400" />}
          label="Total Units"
          value={<span className="text-purple-400">{num(metrics.totalUnits)}</span>}
          hint={period?.start ? `/ ${target} target` : "Deals finalized"}
        />
      ),
    },
    new_apps_today: {
      label: "New Apps Today",
      render: () => (
        <StatTile
          icon={<UserPlus className="text-blue-400" />}
          label="New Apps Today"
          value={<span className="text-blue-400">{num(newAppsToday)}</span>}
          hint="Always today (any period)"
          onClick={() => navigate(ADMIN_ROUTES.finance)}
        />
      ),
    },
    approvals: {
      label: "Total Approvals",
      render: () => (
        <StatTile
          icon={<CheckCircle2 className="text-green-400" />}
          label="Total Approvals"
          value={<span className="text-green-400">{num(metrics.approvals)}</span>}
          hint="Pre-approved / bank-approved"
          onClick={() => navigate(ADMIN_ROUTES.finance)}
        />
      ),
    },
    valuations: {
      label: "Valuations Done",
      render: () => (
        <StatTile
          icon={<ClipboardCheck className="text-cyan-400" />}
          label="Valuations Done"
          value={<span className="text-cyan-400">{num(metrics.valuations)}</span>}
          hint="Trade-in requests"
          onClick={() => navigate(ADMIN_ROUTES.carsToBuy)}
        />
      ),
    },
    deposits: {
      label: "Client Deposits",
      render: () => (
        <StatTile
          icon={<Banknote className="text-amber-400" />}
          label="Client Deposits"
          value={<span className="text-amber-400">{fmt(metrics.deposits)}</span>}
          hint="Taken on finalized deals"
        />
      ),
    },
    closed_deals: {
      label: "Closed Deals",
      render: () => (
        <StatTile
          icon={<PackageCheck className="text-emerald-400" />}
          label="Closed Deals"
          value={<span className="text-emerald-400">{num(metrics.closedDeals)}</span>}
          hint="Marked closed"
          onClick={() => navigate(ADMIN_ROUTES.dealDesk)}
        />
      ),
    },
    pending_apps: {
      label: "Pending Apps",
      render: () => (
        <StatTile
          icon={<Clock className="text-orange-400" />}
          label="Pending Apps"
          value={<span className="text-orange-400">{num(metrics.pendingApps)}</span>}
          hint="Awaiting action"
          onClick={() => navigate(ADMIN_ROUTES.pipelineV2)}
        />
      ),
    },
    avg_yield: {
      label: "Avg Yield / Unit",
      render: () => (
        <StatTile
          icon={<Calculator className="text-amber-400" />}
          label="Avg Yield / Unit"
          value={<span className="text-amber-400">{fmt(metrics.avgYield)}</span>}
          hint="GP / units"
        />
      ),
    },
    turnover: {
      label: "Total Turnover",
      render: () => (
        <StatTile
          icon={<TrendingUp className="text-blue-400" />}
          label="Total Turnover"
          value={<span className="text-blue-400">{fmt(metrics.turnover)}</span>}
          hint="Vehicle revenue"
        />
      ),
    },
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) reorder(arrayMove(widgets, oldIndex, newIndex));
    }
  };

  const cycleSize = (id: string) => {
    const w = widgets.find((x) => x.id === id);
    if (w) setSize(id, SIZE_CYCLE[w.size]);
  };

  // In customize mode show every widget (so hidden ones can be re-enabled);
  // otherwise only render the visible ones, in saved order.
  const renderedWidgets = customizing ? widgets : widgets.filter((w) => w.visible);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          Loading Command Center…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>Command Center | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <PageHeader
        icon={<BarChart3 />}
        title="Command Center"
        subtitle={period?.label}
        actions={
          <>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant={customizing ? "default" : "outline"}
              onClick={() => setCustomizing((v) => !v)}
            >
              <Sliders className="w-4 h-4 mr-2" />
              {customizing ? "Done" : "Customize"}
            </Button>

            <Button size="sm" variant="outline" onClick={() => navigate(ADMIN_ROUTES.quotes)}>
              <Calculator className="w-4 h-4 mr-2" />
              Quick Quote
            </Button>
            <Button size="sm" onClick={() => navigate(ADMIN_ROUTES.pipelineV2)}>
              <Search className="w-4 h-4 mr-2" />
              Pipeline
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-6">
        {customizing && (
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Drag to reorder · click the size icon to resize · toggle visibility below.
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Show / Hide widgets
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Widgets</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {widgets.map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleVisible(w.id);
                      }}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>{WIDGET_DEFS[w.id]?.label ?? w.id}</span>
                      <Switch checked={w.visible} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </Card>
        )}

        {/* KPI WIDGET GRID — customizable, drag-reorderable */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={renderedWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-12">
              {renderedWidgets.map((w) => {
                const def = WIDGET_DEFS[w.id];
                if (!def) return null;
                return (
                  <SortableWidget
                    key={w.id}
                    widget={w}
                    customizing={customizing}
                    onToggleVisible={toggleVisible}
                    onCycleSize={cycleSize}
                    label={def.label}
                  >
                    <div className={!w.visible && customizing ? "opacity-40" : ""}>
                      {def.render()}
                    </div>
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* ACTION MATRIX — preserved from the original dashboard */}
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
                onClick={() => navigate(ADMIN_ROUTES.pipelineV2)}
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
                {urgentLeads.map((lead) => {
                  const ts = lead.updated_at || lead.created_at;
                  const formattedDate = ts ? format(new Date(ts), "dd MMM yyyy • HH:mm") : "";
                  return (
                    <div
                      key={lead.id}
                      className="grid grid-cols-3 items-center gap-2 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(ADMIN_ROUTES.pipelineV2)}
                    >
                      <div className="justify-self-start min-w-0">
                        <p className="font-medium text-sm truncate">
                          {lead.client_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.client_phone || "No phone"}
                        </p>
                      </div>
                      <div className="hidden md:flex justify-center text-xs text-zinc-500 font-mono tracking-wide">
                        {formattedDate}
                      </div>
                      <div className="flex items-center gap-2 justify-self-end">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 whitespace-nowrap">
                          {(lead.pipeline_stage || "new").replace(/_/g, " ")}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
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
                onClick={() => navigate("/admin/reports/lead-analytics")}
                className="text-left p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
              >
                <div className="flex items-center gap-2 mb-2 text-emerald-400">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Volume</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{activityToday.totalVolume.toLocaleString()}</p>
              </button>

              <button
                onClick={() => navigate(ADMIN_ROUTES.pipelineV2)}
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
                onClick={() => navigate("/admin/reports/lead-analytics")}
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
