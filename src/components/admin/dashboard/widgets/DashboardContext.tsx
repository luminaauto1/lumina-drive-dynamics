import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

/**
 * Persist the shared finance range so it survives reloads. Kept in its own key
 * (NOT the useDashboardLayout config) so the two independent providers never race
 * to write the same localStorage entry.
 */
const RANGE_STORAGE_KEY = 'lumina.admin.dashboard.range.v1';
const VALID_RANGE_KEYS: RangeKey[] = ['today', 'yesterday', 'week', 'month', 'custom'];

function readPersistedRange(): DashboardRange {
  if (typeof window === 'undefined') return { key: 'today' };
  try {
    const raw = window.localStorage.getItem(RANGE_STORAGE_KEY);
    if (!raw) return { key: 'today' };
    const parsed = JSON.parse(raw);
    if (!parsed || !VALID_RANGE_KEYS.includes(parsed.key)) return { key: 'today' };
    return {
      key: parsed.key,
      from: typeof parsed.from === 'string' ? parsed.from : undefined,
      to: typeof parsed.to === 'string' ? parsed.to : undefined,
    };
  } catch {
    return { key: 'today' };
  }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DashboardRange>(readPersistedRange);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(range));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [range]);
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
