import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FAndIUser {
  id: string;
  name: string;
  email: string | null;
  role: 'f_and_i';
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
        .eq('role', 'f_and_i');
      if (error) throw error;
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
      // Collapse to one row per user; promote to senior if they hold that role.
      const seen = new Map<string, FAndIUser>();
      for (const r of (roles || []) as any[]) {
        const p: any = byId.get(r.user_id) || {};
        const existing = seen.get(r.user_id);
        const role = r.role as 'f_and_i' | 'senior_f_and_i';
        if (existing) {
          if (role === 'senior_f_and_i') existing.role = 'senior_f_and_i';
          continue;
        }
        seen.set(r.user_id, {
          id: r.user_id,
          name: (p.full_name || p.email || 'Unnamed F&I') as string,
          email: p.email || null,
          role,
        });
      }
      return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });
};

