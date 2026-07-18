import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Calculator, Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADMIN_ROUTES } from "@/lib/adminRoutes";
import { useDashboardLayout } from "@/components/admin/dashboard/useDashboardLayout";
import { DashboardGrid } from "@/components/admin/dashboard/DashboardGrid";
import { CustomizePanel } from "@/components/admin/dashboard/CustomizePanel";
import { useGlobalDashboardAdapter } from "@/components/admin/dashboard/useGlobalDashboardAdapter";
import { COMMAND_WIDGET_REGISTRY } from "@/components/admin/dashboard/commandWidgetRegistry";
import {
  CommandDashboardProvider,
  useCommandDashboard,
} from "@/components/admin/dashboard/command/CommandDashboardContext";

/**
 * Command Center — the shared staff landing dashboard.
 *
 * Built on the same widget-grid framework as /admin/analytics
 * (useDashboardLayout + DashboardGrid + CustomizePanel), but with:
 *  - its own registry (COMMAND_WIDGET_REGISTRY), and
 *  - a DB storage adapter: ONE global layout for every staff member, stored in
 *    site_settings.document_settings.commandDashboardLayout. Super-admins get
 *    the Customize button and their edits apply to everyone; other staff see a
 *    read-only layout.
 *
 * The period selector (current month / 11 prior months / Overall) lives in the
 * header and feeds every widget via CommandDashboardContext.
 */

/* ── Greeting ─────────────────────────────────────────────────────────────────── */

/** First name for the greeting: auth metadata → profiles.full_name → email prefix → 'there'. */
function useFirstName(): string {
  const { user } = useAuth();
  const metaName = ((user?.user_metadata as any)?.full_name as string | undefined)?.trim();

  const { data: profileName } = useQuery({
    queryKey: ["profile-full-name", user?.id],
    enabled: !!user?.id && !metaName,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return ((data as any)?.full_name as string | null) ?? null;
    },
  });

  const source = metaName || profileName?.trim() || "";
  if (source) return source.split(/\s+/)[0];
  const emailPrefix = user?.email?.split("@")[0];
  return emailPrefix || "there";
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* ── Loading skeleton while the shared layout loads from the DB ───────────────── */

function GridSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

/* ── Page body (inside the provider so the header selector reaches context) ───── */

const CommandCenterContent = () => {
  const navigate = useNavigate();
  const adapter = useGlobalDashboardAdapter();
  const api = useDashboardLayout({ registry: COMMAND_WIDGET_REGISTRY, adapter });
  const { periods, periodKey, setPeriodKey } = useCommandDashboard();
  const firstName = useFirstName();

  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const dateLine = now.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 p-6">
      {/* Greeting header + fixed controls */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting}, {firstName}{" "}
            <span aria-hidden className="inline-block">
              👋
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{dateLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodKey} onValueChange={setPeriodKey}>
            <SelectTrigger className="h-9 w-[200px]">
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

          <Button size="sm" variant="outline" className="h-9" onClick={() => navigate(ADMIN_ROUTES.quotes)}>
            <Calculator className="mr-2 h-4 w-4" />
            Quick Quote
          </Button>
          <Button size="sm" className="h-9" onClick={() => navigate(ADMIN_ROUTES.pipelineV2)}>
            <Search className="mr-2 h-4 w-4" />
            Pipeline
          </Button>

          {/* Super-admins only: edits here update the ONE shared layout. */}
          {api.canEdit && (
            <>
              {api.editMode && (
                <Button size="sm" className="h-9" onClick={() => api.setEditMode(false)}>
                  <Check className="mr-2 h-4 w-4" />
                  Done
                </Button>
              )}
              <CustomizePanel
                api={api}
                registry={COMMAND_WIDGET_REGISTRY}
                description="Toggle widgets, rearrange the layout, or reset to the default view. This dashboard is shared — your changes apply to every staff member."
              />
            </>
          )}
        </div>
      </header>

      {api.editMode && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          <span>
            Editing the shared dashboard — drag tiles by their header, resize from the corner, or hide
            with the eye button. Changes save for <span className="font-medium text-foreground">all users</span>.
          </span>
        </div>
      )}

      {api.ready ? (
        <DashboardGrid
          registry={COMMAND_WIDGET_REGISTRY}
          layout={api.layout}
          visibleIds={api.visibleIds}
          editMode={api.editMode}
          onLayoutChange={api.setLayout}
          onHideWidget={api.canEdit ? api.toggleVisible : undefined}
        />
      ) : (
        <GridSkeleton />
      )}
    </div>
  );
};

const AdminDashboard = () => (
  <AdminLayout>
    <Helmet>
      <title>Command Center | Lumina Auto</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <CommandDashboardProvider>
      <CommandCenterContent />
    </CommandDashboardProvider>
  </AdminLayout>
);

export default AdminDashboard;
