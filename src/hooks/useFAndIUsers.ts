import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FAndIUser {
  id: string;
  name: string;
  email: string | null;
  role: 'f_and_i' | 'senior_f_and_i';
}

/**
 * Returns all profiles that hold an F&I role (standard or senior).
 * Used to power the manual "Assign F&I" dropdown in submission popups.
 */
export const useFAndIUsers = () => {
  return useQuery<FAndIUser[]>({
    queryKey: ['f-and-i-users'],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['f_and_i', 'senior_f_and_i'] as any);
      if (error) throw error;
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return (roles || []).map((r: any) => {
        const p: any = byId.get(r.user_id) || {};
        return {
          id: r.user_id,
          name: (p.full_name || p.email || 'Unnamed F&I') as string,
          email: p.email || null,
          role: r.role,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });
};
