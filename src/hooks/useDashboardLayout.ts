import { useCallback, useEffect, useState } from "react";

/**
 * Per-user, localStorage-backed layout for the customizable Command Center
 * dashboard. Mirrors the "phone widgets" idea: each KPI widget can be shown or
 * hidden, sized (small / medium / large = grid column span), and reordered via
 * drag. No DB schema is touched — the layout is a personal UI preference so it
 * lives entirely in localStorage, keyed per signed-in user.
 *
 * Stored shape is intentionally small (id + order + size + visible) so adding a
 * new widget id to DEFAULT_WIDGET_IDS auto-appends it for existing users via the
 * reconcile pass below — old saved layouts never hide widgets they predate.
 */

export type WidgetSize = "small" | "medium" | "large";

/** Grid column span for each size on the lg 12-col grid. */
export const WIDGET_SPAN: Record<WidgetSize, string> = {
  small: "lg:col-span-3",
  medium: "lg:col-span-4",
  large: "lg:col-span-6",
};

export interface DashboardWidget {
  id: string;
  size: WidgetSize;
  visible: boolean;
}

/**
 * Canonical widget order + default sizing/visibility. The dashboard component
 * owns the id → render mapping; this is purely the catalogue + default layout.
 * Keep ids stable — they are the localStorage key for a user's customizations.
 */
export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "gross_profit", size: "small", visible: true },
  { id: "total_units", size: "small", visible: true },
  { id: "new_apps_today", size: "small", visible: true },
  { id: "approvals", size: "small", visible: true },
  { id: "deposits", size: "small", visible: true },
  { id: "closed_deals", size: "small", visible: true },
  { id: "pending_apps", size: "small", visible: true },
  { id: "avg_yield", size: "small", visible: true },
  { id: "turnover", size: "small", visible: true },
];

const DEFAULT_WIDGET_IDS = DEFAULT_WIDGETS.map((w) => w.id);

const STORAGE_PREFIX = "lumina:dashboard-layout:";
const storageKey = (userId?: string | null) =>
  `${STORAGE_PREFIX}${userId || "anon"}`;

/**
 * Reconcile a saved layout against the current widget catalogue:
 *  - drop ids that no longer exist
 *  - append any new widget ids (with their defaults) at the end
 * so the layout is always complete and never references a removed widget.
 */
const reconcile = (saved: DashboardWidget[]): DashboardWidget[] => {
  const byId = new Map(saved.map((w) => [w.id, w]));
  const known = saved.filter((w) => DEFAULT_WIDGET_IDS.includes(w.id));
  const missing = DEFAULT_WIDGETS.filter((w) => !byId.has(w.id));
  return [...known, ...missing];
};

export function useDashboardLayout(userId?: string | null) {
  const key = storageKey(userId);

  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);

  // Load (and reconcile) whenever the user changes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardWidget[];
        if (Array.isArray(parsed) && parsed.length) {
          setWidgets(reconcile(parsed));
          return;
        }
      }
    } catch {
      /* corrupt entry → fall back to defaults */
    }
    setWidgets(DEFAULT_WIDGETS);
  }, [key]);

  const persist = useCallback(
    (next: DashboardWidget[]) => {
      setWidgets(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* quota / private mode → keep in-memory only */
      }
    },
    [key],
  );

  const toggleVisible = useCallback(
    (id: string) =>
      persist(
        widgets.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w,
        ),
      ),
    [widgets, persist],
  );

  const setSize = useCallback(
    (id: string, size: WidgetSize) =>
      persist(widgets.map((w) => (w.id === id ? { ...w, size } : w))),
    [widgets, persist],
  );

  const reorder = useCallback(
    (next: DashboardWidget[]) => persist(next),
    [persist],
  );

  const reset = useCallback(() => persist(DEFAULT_WIDGETS), [persist]);

  return { widgets, toggleVisible, setSize, reorder, reset };
}
