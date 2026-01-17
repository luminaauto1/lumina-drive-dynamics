import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ApplicationMatch {
  id: string;
  application_id: string;
  vehicle_id: string;
  created_at: string;
  notes: string | null;
}

export const useApplicationMatches = (applicationId: string) => {
  return useQuery({
    queryKey: ['application-matches', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_matches')
        .select('*, vehicles(*)')
        .eq('application_id', applicationId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });
};

export const useUserApplicationMatches = (userId: string) => {
  return useQuery({
    queryKey: ['user-application-matches', userId],
    queryFn: async () => {
      // Get user's approved applications
      const { data: apps, error: appsError } = await supabase
        .from('finance_applications')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'approved');
      
      if (appsError) throw appsError;
      if (!apps || apps.length === 0) return [];

      const appIds = apps.map(a => a.id);
      
      // Fetch matches with vehicles, filtering for finance_available AND available status
      const { data, error } = await supabase
        .from('application_matches')
        .select('*, vehicles!inner(*)')
        .in('application_id', appIds)
        .eq('vehicles.finance_available', true)
        .eq('vehicles.status', 'available');
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useAddApplicationMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, vehicleId, notes }: { applicationId: string; vehicleId: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('application_matches')
        .insert({
          application_id: applicationId,
          vehicle_id: vehicleId,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['application-matches', variables.applicationId] });
      toast.success('Vehicle added to client options');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This vehicle is already matched to this client');
      } else {
        toast.error('Failed to add vehicle');
      }
    },
  });
};

export const useRemoveApplicationMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, applicationId }: { matchId: string; applicationId: string }) => {
      const { error } = await supabase
        .from('application_matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;
      return { applicationId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['application-matches', data.applicationId] });
      toast.success('Vehicle removed from client options');
    },
    onError: () => {
      toast.error('Failed to remove vehicle');
    },
  });
};
