import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExtraService {
  id: string;
  category: string;
  description: string;
  provider_name: string | null;
  cost_price: number;
  selling_price: number;
  status: string;
  transaction_date: string;
  created_at: string;
}

export interface CreateExtraServiceData {
  category: string;
  description: string;
  provider_name?: string;
  cost_price?: number;
  selling_price?: number;
  status?: string;
  transaction_date?: string;
}

export const SERVICE_CATEGORIES = [
  { value: 'rubberising', label: 'Rubberising' },
  { value: 'parts', label: 'Parts Sales' },
  { value: 'tinting', label: 'Window Tinting' },
  { value: 'outsourced', label: 'Outsourced Work' },
  { value: 'detailing', label: 'Detailing' },
  { value: 'other', label: 'Other' },
] as const;

export const useExtraServices = () => {
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['extra-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extra_service_incomes')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data as ExtraService[];
    },
  });

  const createService = useMutation({
    mutationFn: async (service: CreateExtraServiceData) => {
      const { data, error } = await supabase
        .from('extra_service_incomes')
        .insert(service)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extra-services'] });
      toast.success('Service income logged');
    },
    onError: (error) => {
      toast.error('Failed to log service: ' + error.message);
    },
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExtraService> & { id: string }) => {
      const { data, error } = await supabase
        .from('extra_service_incomes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extra-services'] });
      toast.success('Service updated');
    },
    onError: (error) => {
      toast.error('Failed to update service: ' + error.message);
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('extra_service_incomes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extra-services'] });
      toast.success('Service deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete service: ' + error.message);
    },
  });

  const totalProfit = services.reduce((sum, s) => {
    return sum + (Number(s.selling_price) - Number(s.cost_price));
  }, 0);

  const totalRevenue = services.reduce((sum, s) => sum + Number(s.selling_price), 0);
  const totalCosts = services.reduce((sum, s) => sum + Number(s.cost_price), 0);

  return {
    services,
    isLoading,
    createService,
    updateService,
    deleteService,
    totalProfit,
    totalRevenue,
    totalCosts,
  };
};
