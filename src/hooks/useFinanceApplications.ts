import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type FinanceApplication = Tables<'finance_applications'> & {
  vehicle?: {
    make: string;
    model: string;
    year: number;
  };
};

export const useFinanceApplications = () => {
  return useQuery({
    queryKey: ['finance-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_applications')
        .select(`
          *,
          vehicle:vehicles(make, model, year)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FinanceApplication[];
    },
  });
};

export const useUpdateFinanceApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FinanceApplication> }) => {
      const { data, error } = await supabase
        .from('finance_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      toast.success('Application updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update application: ' + error.message);
    },
  });
};