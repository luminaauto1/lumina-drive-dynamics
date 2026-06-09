import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FniMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_senior: boolean;
}

/**
 * Fetches all profiles flagged as F&I team members
 * (role = 'f_and_i' or 'senior_f_and_i'). Deduplicated by user_id.
 */
export const useFniMembers = () => {
  return useQuery({
    queryKey: ['fni-members'],
    queryFn: async (): Promise<FniMember[]> => {
      const { data: roleRows, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['f_and_i', 'senior_f_and_i'] as any);
      if (error) throw error;

      const map = new Map<string, { is_senior: boolean }>();
      (roleRows || []).forEach((r: any) => {
        const prev = map.get(r.user_id);
        const is_senior = (prev?.is_senior ?? false) || r.role === 'senior_f_and_i';
        map.set(r.user_id, { is_senior });
      });

      const ids = Array.from(map.keys());
      if (ids.length === 0) return [];

      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);

      return (profs || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        is_senior: map.get(p.user_id)?.is_senior ?? false,
      })).sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''));
    },
    staleTime: 5 * 60 * 1000,
  });
};
