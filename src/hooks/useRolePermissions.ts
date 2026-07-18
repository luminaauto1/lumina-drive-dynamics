import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ConfigurableRole, DEFAULT_ROLE_SECTIONS, SECTION_KEYS,
} from '@/lib/permissions';

// role_section_access isn't in the generated Supabase types yet — cast via `as any`.
const db = supabase as any;

export type RoleSectionMap = Record<ConfigurableRole, string[]>;

/** All roles' allowed section keys, merged over the built-in defaults so a missing
 *  row (or a transient read error) falls back to shipped behaviour, never to "no access". */
export const useRoleSectionAccess = () =>
  useQuery({
    queryKey: ['role-section-access'],
    queryFn: async (): Promise<RoleSectionMap> => {
      const merged: RoleSectionMap = {
        sales_agent: [...DEFAULT_ROLE_SECTIONS.sales_agent],
        f_and_i: [...DEFAULT_ROLE_SECTIONS.f_and_i],
        senior_f_and_i: [...DEFAULT_ROLE_SECTIONS.senior_f_and_i],
        accountant: [...DEFAULT_ROLE_SECTIONS.accountant],
      };
      try {
        const { data, error } = await db.from('role_section_access').select('role, sections');
        if (error) throw error;
        for (const row of data ?? []) {
          if (row?.role && Array.isArray(row.sections) && row.role in merged) {
            merged[row.role as ConfigurableRole] = row.sections.filter((s: string) => SECTION_KEYS.includes(s));
          }
        }
      } catch {
        // keep defaults
      }
      return merged;
    },
    staleTime: 60_000,
  });

/** Effective DB role key for the signed-in user (or 'admin' for full access). */
const useEffectiveRole = (): 'admin' | ConfigurableRole | null => {
  const { isSuperAdmin, isAccountant, role } = useAuth();
  if (isSuperAdmin) return 'admin';
  if (isAccountant) return 'accountant';
  if (role === 'senior_f_and_i') return 'senior_f_and_i';
  if (role === 'f_and_i') return 'f_and_i';
  if (role === 'sales_agent') return 'sales_agent';
  return null;
};

/** The current user's allowed section keys (admins → all), plus loading state. */
export const useMyAllowedSections = () => {
  const effective = useEffectiveRole();
  const { data: map, isLoading } = useRoleSectionAccess();

  const allowed = useMemo(() => {
    if (effective === 'admin') return new Set(SECTION_KEYS);
    if (!effective) return new Set<string>();
    const list = map?.[effective] ?? DEFAULT_ROLE_SECTIONS[effective];
    const set = new Set(list);
    // CRM was retired in admin-v2: its nav/route now redirect to the Pipeline.
    // Any role granted the legacy `crm` section must therefore also be able to
    // open `pipeline_v2` — otherwise the redirect lands them on a section they
    // lack and ProtectedRoute bounces them away (and for a crm-first role can
    // ping-pong between /admin/crm and /admin/pipeline-v2). Treat crm ⇒ pipeline_v2.
    if (set.has('crm')) set.add('pipeline_v2');
    // The Command Center (/admin) is every staff member's shared home/landing
    // page — force-grant it for any resolved staff role. This also covers
    // role_section_access rows saved BEFORE the dashboard section existed
    // (they override DEFAULT_ROLE_SECTIONS and would otherwise lock staff out).
    set.add('dashboard');
    return set;
  }, [effective, map]);

  return { allowed, isAdmin: effective === 'admin', isLoading: effective !== 'admin' && isLoading, effective };
};

export const useUpdateRoleSections = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ role, sections }: { role: ConfigurableRole; sections: string[] }) => {
      const clean = sections.filter((s) => SECTION_KEYS.includes(s));
      const { error } = await db.from('role_section_access').upsert(
        { role, sections: clean, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
        { onConflict: 'role' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role-section-access'] });
      toast.success('Permissions saved');
    },
    onError: (e: any) => toast.error('Could not save permissions: ' + e.message),
  });
};
