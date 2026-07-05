import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadsCycleStats {
  total: number;
  blacklisted: number;
  notBlacklisted: number;
  unknown: number;
}

// TikTok leads arrive via make.com (platform 'make.com') or the direct TikTok
// webhook (platform 'tiktok'); older rows may only carry source = 'TikTok'.
const TIKTOK_LEADS_FILTER = 'platform.eq.make.com,platform.eq.tiktok,source.eq.TikTok';

// Head-only count — no row data leaves the database.
// blacklistFlag: true/false filter on is_blacklisted, null for IS NULL, undefined for no filter.
const countLeads = async (fromIso: string, toIso: string, blacklistFlag?: boolean | null): Promise<number> => {
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .or(TIKTOK_LEADS_FILTER)
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
      const [total, blacklisted, notBlacklisted, unknown] = await Promise.all([
        countLeads(fromIso, toIso),
        countLeads(fromIso, toIso, true),
        countLeads(fromIso, toIso, false),
        countLeads(fromIso, toIso, null),
      ]);
      return { total, blacklisted, notBlacklisted, unknown };
    },
  });
};
