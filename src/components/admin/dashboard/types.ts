import type { ComponentType } from 'react';

/**
 * A single dashboard widget definition. One visual unit of the analytics page
 * (a KPI tile, a chart, a leaderboard, …) is described by one WidgetDef.
 *
 * `defaultLayout` is expressed in react-grid-layout grid units against the 12-col
 * `lg` breakpoint. `w`/`h` are the default tile span; `minW`/`minH` clamp resizing.
 */
export interface WidgetLayout {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface WidgetDef {
  /** Stable id — used as the react-grid-layout item key and the localStorage handle. */
  id: string;
  /** Human title shown in the Customize panel widget library. */
  title: string;
  /** Optional grouping label for the widget library (e.g. "Overview", "Finance"). */
  category?: string;
  /** Default tile size + resize clamps on the 12-col grid. */
  defaultLayout: WidgetLayout;
  /**
   * When true, the widget is ALWAYS visible: it can't be toggled off in the
   * Customize panel and is force-included in the default/merged visible set.
   * Used for controls other widgets depend on (e.g. the shared finance range).
   */
  pinned?: boolean;
  /** The widget body. Rendered inside a themed card container by DashboardGrid. */
  Component: ComponentType;
}
