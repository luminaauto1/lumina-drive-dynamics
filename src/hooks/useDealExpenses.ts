// Deal-level expenses — a mirror of useVehicleExpenses, but attached to the DEAL via
// its application_id (the deal's through-line, works pre- and post-finalize). These
// combine with the linked car's vehicle_expenses to make up the deal's total costs;
// at finalize the sum is folded into gross_profit and snapshotted into
// deal_records.aftersales_expenses so existing readers are untouched.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Reuse the same category list as vehicle (recon) expenses for a consistent UX.
export { EXPENSE_CATEGORIES } from '@/hooks/useVehicleExpenses';

export interface DealExpense {
  id: string;
  application_id: string | null;
  deal_id: string | null;
  description: string;
  amount: number;
  category: string;
  receipt_url: string | null;
  date_incurred: string;
  created_at: string;
}

export const useDealExpenses = (applicationId?: string | null) => {
  return useQuery({
    queryKey: ['deal-expenses', applicationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deal_expenses')
        .select('*')
        .eq('application_id', applicationId)
        .order('date_incurred', { ascending: false });
      if (error) throw error;
      return (data || []) as DealExpense[];
    },
    enabled: !!applicationId,
  });
};

export const useCreateDealExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Omit<DealExpense, 'id' | 'created_at'>) => {
      const { data, error } = await (supabase as any)
        .from('deal_expenses')
        .insert(expense)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-expenses', variables.application_id] });
      queryClient.invalidateQueries({ queryKey: ['deal-expenses-total', variables.application_id] });
      toast.success('Deal expense added');
    },
    onError: (error: any) => toast.error('Failed to add deal expense: ' + error.message),
  });
};

export const useUpdateDealExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DealExpense> }) => {
      const { data, error } = await (supabase as any)
        .from('deal_expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['deal-expenses-total'] });
      toast.success('Deal expense updated');
    },
    onError: (error: any) => toast.error('Failed to update deal expense: ' + error.message),
  });
};

export const useDeleteDealExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('deal_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['deal-expenses-total'] });
      toast.success('Deal expense deleted');
    },
    onError: (error: any) => toast.error('Failed to delete deal expense: ' + error.message),
  });
};

export const useTotalDealExpenses = (applicationId?: string | null) => {
  return useQuery({
    queryKey: ['deal-expenses-total', applicationId],
    queryFn: async () => {
      if (!applicationId) return 0;
      const { data, error } = await (supabase as any)
        .from('deal_expenses')
        .select('amount')
        .eq('application_id', applicationId);
      if (error) { console.warn('deal_expenses not found:', error.message); return 0; }
      return (data || []).reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);
    },
    enabled: !!applicationId,
  });
};
