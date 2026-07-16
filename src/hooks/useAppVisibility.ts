// Per-user application visibility rules (app_visibility_rules; see
// lib/finance/shared.ts canSeeApplication for the semantics). Staff can read
// all rows (RLS); only admins can write. Small table (one row per staff user
// with a non-default rule), cached for 60s.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { AppVisibilityRule } from '@/lib/finance/shared';

export const useAppVisibilityRules = () =>
  useQuery({
    queryKey: ['app-visibility-rules'],
    staleTime: 60_000,
    queryFn: async (): Promise<AppVisibilityRule[]> => {
      const { data, error } = await (supabase as any)
        .from('app_visibility_rules')
        .select('user_id, mode, visible_user_ids, can_archive');
      if (error) throw error;
      return (data ?? []) as AppVisibilityRule[];
    },
  });

/** The signed-in user's own rule (null = no row → legacy role default). */
export const useMyAppVisibility = (): AppVisibilityRule | null => {
  const { user } = useAuth();
  const { data: rules = [] } = useAppVisibilityRules();
  return rules.find((r) => r.user_id === user?.id) ?? null;
};

export const useUpsertAppVisibility = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: AppVisibilityRule) => {
      const { error } = await (supabase as any)
        .from('app_visibility_rules')
        .upsert({ ...rule, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-visibility-rules'] });
      toast.success('Visibility saved');
    },
    onError: (e: any) => toast.error('Failed to save visibility: ' + e.message),
  });
};
