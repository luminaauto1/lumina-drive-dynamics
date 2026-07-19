import type { ComponentType } from 'react';
import type { Layout } from 'react-grid-layout';

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

/**
 * The persisted snapshot of a dashboard: tile geometry + which widgets show.
 * Stored either per-browser (localStorage — the analytics dashboard) or globally
 * (site_settings.document_settings.commandDashboardLayout — the Command Center).
 */
export interface DashboardPersistedState {
  version: string;
  layout: Layout[];
  visibleIds: string[];
}

/**
 * Where a dashboard's layout lives. useDashboardLayout consumes one of these:
 *  - the built-in localStorage adapter (default; per-browser, always editable), or
 *  - useGlobalDashboardAdapter (DB-backed, ONE shared layout, super-admin-only edits).
 */
export interface DashboardStorageAdapter {
  /** Version-validated saved state. null/undefined = fall back to registry defaults. */
  state: DashboardPersistedState | null | undefined;
  /** True while an async backend is still fetching its saved state. */
  isLoading?: boolean;
  /** False = this user may not edit (no customize/edit affordances). Default true. */
  canEdit?: boolean;
  /** Persist a new layout + visibility snapshot. The adapter stamps its own version. */
  save: (state: { layout: Layout[]; visibleIds: string[] }) => void;
}
