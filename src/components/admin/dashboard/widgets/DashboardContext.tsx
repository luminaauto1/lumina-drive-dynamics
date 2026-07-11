import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAnalyticsDashboard, type RangeKey } from '@/hooks/useAnalyticsDashboard';

/**
 * The finance-activity widgets share ONE date range. The range filter is itself a
 * widget, and any number of finance widgets read the same range — so the range
 * state is hoisted into a context that wraps the grid (in AdminAnalytics).
 *
 * The per-range RPCs live in useAnalyticsDashboard, which is React-Query backed;
 * calling useFinanceDashboard() in several widgets dedupes to one network fetch
 * per query key because they all pass the same range.
 */

export interface DashboardRange {
  key: RangeKey;
  from?: string;
  to?: string;
}

interface RangeCtxValue {
  range: DashboardRange;
  setRange: (r: DashboardRange) => void;
}

const RangeCtx = createContext<RangeCtxValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DashboardRange>({ key: 'today' });
  const value = useMemo(() => ({ range, setRange }), [range]);
  return <RangeCtx.Provider value={value}>{children}</RangeCtx.Provider>;
}

export function useDashboardRange(): RangeCtxValue {
  const ctx = useContext(RangeCtx);
  if (!ctx) {
    // Defensive fallback so a widget rendered outside the provider still works.
    return { range: { key: 'today' }, setRange: () => {} };
  }
  return ctx;
}

/** The shared finance-activity dashboard queries for the current range. */
export function useFinanceDashboard() {
  const { range } = useDashboardRange();
  return useAnalyticsDashboard(range);
}
