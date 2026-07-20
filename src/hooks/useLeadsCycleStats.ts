import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadsCycleStats {
  total: number;
  blacklisted: number;
  notBlacklisted: number;
  unknown: number;
  /** Landed straight from TikTok's webhook into tiktok-receiver. */
  direct: number;
  /** Came through the Make.com relay (the pre-2026-07-20 route). */
  viaMake: number;
}

// TikTok leads arrive via make.com (platform 'make.com') or the direct TikTok
// webhook (platform 'tiktok'); older rows may only carry source = 'TikTok'.
const TIKTOK_LEADS_FILTER = 'platform.eq.make.com,platform.eq.tiktok,source.eq.TikTok';

// Route split, used to watch the Make.com -> direct cutover. `direct` and
// `viaMake` will not always sum to `total`: legacy rows carry only
// source = 'TikTok' with no platform, and a returning customer enriched by the
// direct webhook keeps the platform it was first captured under.
const DIRECT_FILTER = 'platform.eq.tiktok,origin.eq.tiktok_lead_ad';
const VIA_MAKE_FILTER = 'platform.eq.make.com,origin.eq.make_webhook';

// Head-only count — no row data leaves the database.
// blacklistFlag: true/false filter on is_blacklisted, null for IS NULL, undefined for no filter.
const countLeads = async (
  fromIso: string,
  toIso: string,
  blacklistFlag?: boolean | null,
  routeFilter?: string,
): Promise<number> => {
  // A route filter already implies a TikTok lead, so it replaces the general
  // filter rather than being ANDed with it — stacking two .or() calls relies on
  // PostgREST combining repeated params, which is easy to get subtly wrong.
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .or(routeFilter ?? TIKTOK_LEADS_FILTER)
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  if (blacklistFlag === true || blacklistFlag === false) {
    query = query.eq('is_blacklisted', blacklistFlag);
  } else if (blacklistFlag === null) {
    query = query.is('is_blacklisted', null);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

export const useLeadsCycleStats = (from: Date, to: Date) => {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  return useQuery({
    queryKey: ['leads-cycle-counts', fromIso, toIso],
    queryFn: async (): Promise<LeadsCycleStats> => {
      const [total, blacklisted, notBlacklisted, unknown, direct, viaMake] = await Promise.all([
        countLeads(fromIso, toIso),
        countLeads(fromIso, toIso, true),
        countLeads(fromIso, toIso, false),
        countLeads(fromIso, toIso, null),
        countLeads(fromIso, toIso, undefined, DIRECT_FILTER),
        countLeads(fromIso, toIso, undefined, VIA_MAKE_FILTER),
      ]);
      return { total, blacklisted, notBlacklisted, unknown, direct, viaMake };
    },
  });
};
