import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DealAddon {
  id: string;
  application_id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  category: 'admin' | 'accessory' | 'warranty' | null;
  created_at: string;
}

export const useDealAddons = (applicationId?: string) => {
  return useQuery({
    queryKey: ['deal-addons', applicationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deal_addons')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });
      
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []) as DealAddon[];
    },
    enabled: !!applicationId,
  });
};

export const useCreateDealAddon = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (addon: {
      application_id: string;
      name: string;
      cost_price: number;
      selling_price: number;
      category?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('deal_addons')
        .insert(addon)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-addons', variables.application_id] });
      toast.success('Add-on added to deal');
    },
    onError: () => {
      toast.error('Failed to add add-on');
    },
  });
};

export const useDeleteDealAddon = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, applicationId }: { id: string; applicationId: string }) => {
      const { error } = await (supabase as any)
        .from('deal_addons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return applicationId;
    },
    onSuccess: (applicationId) => {
      queryClient.invalidateQueries({ queryKey: ['deal-addons', applicationId] });
      toast.success('Add-on removed');
    },
    onError: () => {
      toast.error('Failed to remove add-on');
    },
  });
};
