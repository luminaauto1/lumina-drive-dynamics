import type { WidgetDef } from './types';
import { PipelineSpreadWidget, RevenueTrendWidget } from './widgets/OverviewWidgets';
import {
  GrossProfitWidget,
  TotalUnitsWidget,
  NewAppsTodayWidget,
  ApprovalsWidget,
  DepositsWidget,
  ClosedDealsWidget,
  PendingAppsWidget,
  AvgYieldWidget,
  TurnoverWidget,
  ActivityStripWidget,
  CommandCreditChecksWidget,
  CommandTopRepsWidget,
  CommandDecisionsWidget,
  AwaitingFinalizeWidget,
  NatisDueWidget,
} from './command/CommandWidgets';

/**
 * Widget registry for the Command Center (/admin).
 *
 * Same contract as the analytics WIDGET_REGISTRY: registering a widget here is
 * the ONLY step needed to add it to the shared layout + Customize library. The
 * layout is GLOBAL (site_settings.document_settings.commandDashboardLayout via
 * useGlobalDashboardAdapter) — registry order = the default shelf-packed
 * arrangement everyone sees until a super-admin customizes it.
 *
 * Categories group the Customize panel library: Money / Pipeline / Activity.
 *
 * Ids are stable persistence keys — the nine period KPIs keep the ids the old
 * dnd-kit dashboard used (gross_profit, total_units, …).
 */
export const COMMAND_WIDGET_REGISTRY: WidgetDef[] = [
  // ── Row 1: greeting-adjacent KPI row ──
  {
    id: 'gross_profit',
    title: 'Total GP',
    category: 'Money',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: GrossProfitWidget,
  },
  {
    id: 'total_units',
    title: 'Total Units',
    category: 'Pipeline',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: TotalUnitsWidget,
  },
  {
    id: 'approvals',
    title: 'Total Approvals',
    category: 'Pipeline',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: ApprovalsWidget,
  },
  {
    id: 'new_apps_today',
    title: 'New Apps Today',
    category: 'Activity',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: NewAppsTodayWidget,
  },

  // ── Row 2: money + pipeline KPIs ──
  {
    id: 'turnover',
    title: 'Total Turnover',
    category: 'Money',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: TurnoverWidget,
  },
  {
    id: 'deposits',
    title: 'Client Deposits',
    category: 'Money',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: DepositsWidget,
  },
  {
    id: 'closed_deals',
    title: 'Closed Deals',
    category: 'Pipeline',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: ClosedDealsWidget,
  },
  {
    id: 'pending_apps',
    title: 'Pending Apps',
    category: 'Pipeline',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: PendingAppsWidget,
  },

  // ── Row 3: yield + back-office backlogs ──
  {
    id: 'avg_yield',
    title: 'Avg Yield / Unit',
    category: 'Money',
    defaultLayout: { w: 4, h: 2, minW: 2, minH: 2 },
    Component: AvgYieldWidget,
  },
  {
    id: 'awaiting_finalize',
    title: 'Awaiting Finalize',
    category: 'Pipeline',
    defaultLayout: { w: 4, h: 2, minW: 2, minH: 2 },
    Component: AwaitingFinalizeWidget,
  },
  {
    id: 'natis_due',
    title: 'NATIS Due Soon',
    category: 'Pipeline',
    defaultLayout: { w: 4, h: 2, minW: 2, minH: 2 },
    Component: NatisDueWidget,
  },

  // ── Row 4: charts row ──
  {
    id: 'lane_spread',
    title: 'Pipeline Spread',
    category: 'Pipeline',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 4 },
    Component: PipelineSpreadWidget,
  },
  {
    id: 'revenue_trend',
    title: '6-Month Revenue Trend',
    category: 'Money',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 4 },
    Component: RevenueTrendWidget,
  },

  // ── Row 5: today's activity strip (wide) ──
  {
    id: 'activity_strip',
    title: 'Lead & Communication Activity',
    category: 'Activity',
    defaultLayout: { w: 12, h: 3, minW: 6, minH: 3 },
    Component: ActivityStripWidget,
  },

  // ── Row 6: finance activity breakdowns ──
  {
    id: 'credit_checks',
    title: 'Credit Checks (Pass/Fail)',
    category: 'Activity',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: CommandCreditChecksWidget,
  },
  {
    id: 'decisions_daily',
    title: 'Decisions · Last 14 Days',
    category: 'Activity',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: CommandDecisionsWidget,
  },
  {
    id: 'top_reps',
    title: 'Top Reps',
    category: 'Activity',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: CommandTopRepsWidget,
  },
];
