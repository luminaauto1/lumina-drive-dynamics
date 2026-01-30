import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FinanceBank {
  id: string;
  name: string;
  signing_url: string | null;
  created_at: string;
}

export const useFinanceBanks = () => {
  return useQuery({
    queryKey: ['finance-banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_banks')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as FinanceBank[];
    },
  });
};

export const useCreateFinanceBank = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, signing_url }: { name: string; signing_url?: string }) => {
      const { data, error } = await supabase
        .from('finance_banks')
        .insert({ name, signing_url: signing_url || null })
        .select()
        .single();
      
      if (error) throw error;
      return data as FinanceBank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-banks'] });
      toast.success('Bank added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add bank: ' + error.message);
    },
  });
};

export const useUpdateFinanceBank = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, signing_url }: { id: string; name: string; signing_url?: string }) => {
      const { data, error } = await supabase
        .from('finance_banks')
        .update({ name, signing_url: signing_url || null })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FinanceBank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-banks'] });
      toast.success('Bank updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update bank: ' + error.message);
    },
  });
};

export const useDeleteFinanceBank = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finance_banks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-banks'] });
      toast.success('Bank deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete bank: ' + error.message);
    },
  });
};
