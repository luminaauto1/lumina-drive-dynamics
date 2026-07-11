import type { WidgetDef } from './types';
import {
  TotalLeadsWidget,
  DealsClosedWidget,
  ConversionRateWidget,
  NetProfitWidget,
  PipelineSpreadWidget,
  RevenueTrendWidget,
} from './widgets/OverviewWidgets';
import {
  FinanceRangeWidget,
  FinanceReceivedWidget,
  FinanceSubmittedWidget,
  FinanceApprovedWidget,
  FinanceDeclinedWidget,
  ApprovalRateWidget,
  SubmissionRateWidget,
  DeclineRateWidget,
  AvgWorkingTimeWidget,
  DecisionsDailyWidget,
  TopRepsWidget,
} from './widgets/FinanceWidgets';
import {
  CreditCheckPassFailWidget,
  SourceBreakdownWidget,
  LaneCountsWidget,
} from './widgets/CreditWidgets';

/**
 * Central registry of every dashboard widget.
 *
 * Registering a widget here is the ONLY step needed to make it appear in the
 * Customize library + default layout — the framework (useDashboardLayout /
 * DashboardGrid / CustomizePanel) derives all of its defaults from this array.
 *
 * `defaultLayout` units are react-grid-layout cells on the 12-col `lg` grid
 * (rowHeight 56px, margin 16px). Registry order = left-to-right shelf-packing of
 * the default layout, so the ordering below controls the out-of-the-box arrangement.
 */
export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── Row 1: overview KPI tiles ──
  {
    id: 'total-leads',
    title: 'Total Leads',
    category: 'KPI',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: TotalLeadsWidget,
  },
  {
    id: 'deals-closed',
    title: 'Deals Closed',
    category: 'KPI',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: DealsClosedWidget,
  },
  {
    id: 'conversion-rate',
    title: 'Conversion Rate',
    category: 'KPI',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: ConversionRateWidget,
  },
  {
    id: 'net-profit',
    title: 'Net Profit',
    category: 'KPI',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: NetProfitWidget,
  },

  // ── Row 2: overview charts ──
  {
    id: 'pipeline-spread',
    title: 'Pipeline Spread',
    category: 'Charts',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 4 },
    Component: PipelineSpreadWidget,
  },
  {
    id: 'revenue-trend',
    title: '6-Month Revenue Trend',
    category: 'Charts',
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 4 },
    Component: RevenueTrendWidget,
  },

  // ── Row 3: shared finance range filter ──
  {
    id: 'finance-range',
    title: 'Finance Date Range',
    category: 'Finance',
    defaultLayout: { w: 12, h: 2, minW: 4, minH: 2 },
    Component: FinanceRangeWidget,
  },

  // ── Row 4: finance period KPIs ──
  {
    id: 'finance-received',
    title: 'Received',
    category: 'Finance',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: FinanceReceivedWidget,
  },
  {
    id: 'finance-submitted',
    title: 'Submitted',
    category: 'Finance',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: FinanceSubmittedWidget,
  },
  {
    id: 'finance-approved',
    title: 'Approved',
    category: 'Finance',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: FinanceApprovedWidget,
  },
  {
    id: 'finance-declined',
    title: 'Declined',
    category: 'Finance',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: FinanceDeclinedWidget,
  },

  // ── Row 5: finance rate cards ──
  {
    id: 'approval-rate',
    title: 'Approval Rate',
    category: 'Finance',
    defaultLayout: { w: 3, h: 3, minW: 2, minH: 3 },
    Component: ApprovalRateWidget,
  },
  {
    id: 'submission-rate',
    title: 'Submission Rate',
    category: 'Finance',
    defaultLayout: { w: 3, h: 3, minW: 2, minH: 3 },
    Component: SubmissionRateWidget,
  },
  {
    id: 'decline-rate',
    title: 'Decline Rate',
    category: 'Finance',
    defaultLayout: { w: 3, h: 3, minW: 2, minH: 3 },
    Component: DeclineRateWidget,
  },
  {
    id: 'avg-working-time',
    title: 'Avg Working-Time / App',
    category: 'Finance',
    defaultLayout: { w: 3, h: 3, minW: 2, minH: 3 },
    Component: AvgWorkingTimeWidget,
  },

  // ── Row 6: finance charts ──
  {
    id: 'decisions-daily',
    title: 'Decisions · Last 14 Days',
    category: 'Finance',
    defaultLayout: { w: 7, h: 5, minW: 4, minH: 4 },
    Component: DecisionsDailyWidget,
  },
  {
    id: 'top-reps',
    title: 'Top Reps',
    category: 'Finance',
    defaultLayout: { w: 5, h: 5, minW: 3, minH: 4 },
    Component: TopRepsWidget,
  },

  // ── Row 7: credit + pipeline breakdowns ──
  {
    id: 'credit-check',
    title: 'Credit Checks (Pass/Fail)',
    category: 'Credit',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: CreditCheckPassFailWidget,
  },
  {
    id: 'source-breakdown',
    title: 'Applications by Source',
    category: 'Credit',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: SourceBreakdownWidget,
  },
  {
    id: 'lane-counts',
    title: 'Applications by Lane',
    category: 'Credit',
    defaultLayout: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: LaneCountsWidget,
  },
];

/** Look up a widget definition by id. Returns undefined for unknown ids. */
export function getWidget(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}
