import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Ported from ZTC's dashboard maths. New file — does not touch useAnalytics.ts.
// Calls the additive lum_analytics_* RPCs. Casts via `as any` because these RPCs
// aren't in the generated types yet.
const db = supabase as any;

export type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const SAST_OFFSET_MS = 120 * 60000; // UTC+2, no DST
const DAY = 86400000;
const toWall = (d: Date) => new Date(d.getTime() + SAST_OFFSET_MS);
const sastMidnightUTC = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - SAST_OFFSET_MS);
const isoDay = (d: Date) => {
  const w = toWall(d);
  return `${w.getUTCFullYear()}-${String(w.getUTCMonth() + 1).padStart(2, '0')}-${String(w.getUTCDate()).padStart(2, '0')}`;
};

export function computeRange(key: RangeKey, from?: string, to?: string, now = new Date()) {
  const wall = toWall(now);
  const y = wall.getUTCFullYear(), m = wall.getUTCMonth(), d = wall.getUTCDate();
  const todayStart = sastMidnightUTC(y, m, d);
  let since: Date, until: Date, label: string;
  switch (key) {
    case 'yesterday':
      since = new Date(todayStart.getTime() - DAY); until = todayStart; label = 'Yesterday'; break;
    case 'week': {
      const dow = wall.getUTCDay(); const back = (dow + 6) % 7; // Monday start
      since = new Date(todayStart.getTime() - back * DAY); until = new Date(todayStart.getTime() + DAY); label = 'This week'; break;
    }
    case 'month':
      since = sastMidnightUTC(y, m, 1); until = new Date(todayStart.getTime() + DAY); label = 'This month'; break;
    case 'custom': {
      const p = (s?: string): [number, number, number] => {
        const a = (s ?? '').split('-').map(Number);
        return a.length === 3 && a.every(Number.isFinite) ? [a[0], a[1], a[2]] : [y, m + 1, d];
      };
      const f = p(from), t = p(to);
      since = sastMidnightUTC(f[0], f[1] - 1, f[2]);
      let u = new Date(sastMidnightUTC(t[0], t[1] - 1, t[2]).getTime() + DAY);
      if (u.getTime() <= since.getTime()) u = new Date(since.getTime() + DAY);
      until = u; label = `${isoDay(since)} → ${isoDay(new Date(until.getTime() - DAY))}`; break;
    }
    default:
      since = todayStart; until = new Date(todayStart.getTime() + DAY); label = 'Today';
  }
  return { key, label, since, until, from: isoDay(since), to: isoDay(new Date(until.getTime() - DAY)) };
}

export interface AnalyticsRange { key: RangeKey; from?: string; to?: string }

export function useAnalyticsDashboard({ key, from, to }: AnalyticsRange, days = 14) {
  const r = computeRange(key, from, to);
  const since = r.since.toISOString();
  const until = r.until.toISOString();
  const rk = [key, from ?? '', to ?? ''];

  const kpis = useQuery({
    queryKey: ['lum-analytics-kpis', ...rk],
    queryFn: async () => {
      const { data, error } = await db.rpc('lum_analytics_kpis', { p_since: since, p_until: until });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const leaderboard = useQuery({
    queryKey: ['lum-analytics-leaderboard', ...rk],
    queryFn: async () => {
      const { data, error } = await db.rpc('lum_analytics_leaderboard', { p_since: since, p_until: until });
      if (error) throw error;
      return data ?? [];
    },
  });

  const daily = useQuery({
    queryKey: ['lum-analytics-daily', days],
    queryFn: async () => {
      const { data, error } = await db.rpc('lum_analytics_daily', { p_days: days });
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshot = useQuery({
    queryKey: ['lum-analytics-snapshot'],
    queryFn: async () => {
      const { data, error } = await db.rpc('lum_analytics_snapshot');
      if (error) throw error;
      return data?.[0] ?? null;
    },
    refetchInterval: 60000,
  });

  return { range: r, kpis, leaderboard, daily, snapshot,
    isLoading: kpis.isLoading || leaderboard.isLoading || daily.isLoading || snapshot.isLoading };
}
