import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FinanceOffer {
  id: string;
  application_id: string;
  bank_name: string;
  cash_price: number | null;
  license_fee: number | null;
  delivery_fee: number | null;
  admin_fee: number | null;
  initiation_fee: number | null;
  total_fees: number | null;
  principal_debt: number | null;
  balloon_amount: number | null;
  interest_rate_linked: number | null;
  instalment_linked: number | null;
  interest_rate_fixed: number | null;
  instalment_fixed: number | null;
  vap_amount: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceOfferInsert {
  application_id: string;
  bank_name: string;
  cash_price?: number | null;
  license_fee?: number | null;
  delivery_fee?: number | null;
  admin_fee?: number | null;
  initiation_fee?: number | null;
  total_fees?: number | null;
  principal_debt?: number | null;
  balloon_amount?: number | null;
  interest_rate_linked?: number | null;
  instalment_linked?: number | null;
  interest_rate_fixed?: number | null;
  instalment_fixed?: number | null;
  vap_amount?: number | null;
  status?: string;
}

// Fetch all offers for an application
export function useFinanceOffers(applicationId: string) {
  return useQuery({
    queryKey: ['finance-offers', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_offers')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FinanceOffer[];
    },
    enabled: !!applicationId,
  });
}

// Fetch active offer for user's application (client-side)
export function useUserActiveOffer(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-active-offer', userId],
    queryFn: async () => {
      if (!userId) return null;

      // First get user's approved applications
      const { data: apps, error: appError } = await supabase
        .from('finance_applications')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .limit(1);

      if (appError) throw appError;
      if (!apps || apps.length === 0) return null;

      // Get active offer for that application
      const { data: offers, error: offerError } = await supabase
        .from('finance_offers')
        .select('*')
        .eq('application_id', apps[0].id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (offerError) throw offerError;
      return offers?.[0] as FinanceOffer | null;
    },
    enabled: !!userId,
  });
}

// Create a new offer
export function useCreateFinanceOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offer: FinanceOfferInsert) => {
      const { data, error } = await supabase
        .from('finance_offers')
        .insert(offer)
        .select()
        .single();

      if (error) throw error;
      return data as FinanceOffer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['finance-offers', data.application_id] });
      toast.success('Bank offer saved successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to save offer: ' + error.message);
    },
  });
}

// Update an offer
export function useUpdateFinanceOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FinanceOfferInsert> }) => {
      const { data, error } = await supabase
        .from('finance_offers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as FinanceOffer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['finance-offers', data.application_id] });
      toast.success('Offer updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update offer: ' + error.message);
    },
  });
}

// Delete an offer
export function useDeleteFinanceOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finance_offers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-offers'] });
      toast.success('Offer deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete offer: ' + error.message);
    },
  });
}
