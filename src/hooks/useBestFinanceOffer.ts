import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BestFinanceOffer {
  id: string;
  application_id: string;
  bank_name: string;
  interest_rate_linked: number | null;
  interest_rate_fixed: number | null;
  instalment_linked: number | null;
  instalment_fixed: number | null;
  balloon_amount: number | null;
  status: string;
}

// Hook to get the best (lowest instalment) finance offer for current user
export function useBestFinanceOffer() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['best-finance-offer', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get all user's approved applications
      const { data: apps, error: appError } = await supabase
        .from('finance_applications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'approved');

      if (appError) throw appError;
      if (!apps || apps.length === 0) return null;

      const appIds = apps.map(a => a.id);

      // Get all active offers for those applications
      const { data: offers, error: offerError } = await supabase
        .from('finance_offers')
        .select('*')
        .in('application_id', appIds)
        .eq('status', 'active');

      if (offerError) throw offerError;
      if (!offers || offers.length === 0) return null;

      // Find the offer with the lowest instalment
      let bestOffer = offers[0];
      let lowestInstalment = Math.min(
        bestOffer.instalment_linked || Infinity,
        bestOffer.instalment_fixed || Infinity
      );

      for (const offer of offers) {
        const minInstalment = Math.min(
          offer.instalment_linked || Infinity,
          offer.instalment_fixed || Infinity
        );
        if (minInstalment < lowestInstalment) {
          lowestInstalment = minInstalment;
          bestOffer = offer;
        }
      }

      return bestOffer as BestFinanceOffer;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
