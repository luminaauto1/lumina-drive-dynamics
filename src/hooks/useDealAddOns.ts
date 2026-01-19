import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DealAddOn {
  id: string;
  deal_id: string | null;
  application_id: string | null;
  item_name: string;
  cost_price: number;
  selling_price: number;
  category: string | null;
  created_at: string;
}

export const useDealAddOns = (dealId?: string, applicationId?: string) => {
  return useQuery({
    queryKey: ['deal-add-ons', dealId, applicationId],
    queryFn: async () => {
      let query = (supabase as any).from('deal_add_ons').select('*').order('created_at', { ascending: false });
      
      if (dealId) {
        query = query.eq('deal_id', dealId);
      }
      if (applicationId) {
        query = query.eq('application_id', applicationId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('deal_add_ons table not found:', error.message);
        return [];
      }
      return (data || []) as DealAddOn[];
    },
    enabled: !!(dealId || applicationId),
  });
};

export const useCreateDealAddOn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addOn: Omit<DealAddOn, 'id' | 'created_at'>) => {
      const { data, error } = await (supabase as any)
        .from('deal_add_ons')
        .insert(addOn)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-add-ons'] });
      toast.success('Add-on added');
    },
    onError: (error: any) => {
      toast.error('Failed to add add-on: ' + error.message);
    },
  });
};

export const useDeleteDealAddOn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('deal_add_ons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-add-ons'] });
      toast.success('Add-on removed');
    },
    onError: (error: any) => {
      toast.error('Failed to remove add-on: ' + error.message);
    },
  });
};
