import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SellCarRequest {
  id: string;
  client_name: string;
  client_contact: string;
  client_email: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_mileage: number | null;
  desired_price: number | null;
  condition: string | null;
  photos_urls: string[];
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export interface CreateSellCarRequestData {
  client_name: string;
  client_contact: string;
  client_email?: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year?: number;
  vehicle_mileage?: number;
  desired_price?: number;
  condition?: string;
  photos_urls?: string[];
}

export const useSellCarRequests = () => {
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['sell-car-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sell_car_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SellCarRequest[];
    },
  });

  const createRequest = useMutation({
    mutationFn: async (request: CreateSellCarRequestData) => {
      const { data, error } = await supabase
        .from('sell_car_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sell-car-requests'] });
      toast.success('Your vehicle has been submitted for valuation!');
    },
    onError: (error) => {
      toast.error('Failed to submit: ' + error.message);
    },
  });

  const updateRequest = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SellCarRequest> & { id: string }) => {
      const { data, error } = await supabase
        .from('sell_car_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sell-car-requests'] });
      toast.success('Request updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sell_car_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sell-car-requests'] });
      toast.success('Request deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  // Stats
  const newRequests = requests.filter(r => r.status === 'new').length;
  const contactedRequests = requests.filter(r => r.status === 'contacted').length;
  const purchasedRequests = requests.filter(r => r.status === 'purchased').length;

  return {
    requests,
    isLoading,
    createRequest,
    updateRequest,
    deleteRequest,
    newRequests,
    contactedRequests,
    purchasedRequests,
  };
};
