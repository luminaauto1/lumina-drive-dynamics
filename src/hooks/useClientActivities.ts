import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientActivity {
  id: string;
  lead_id: string | null;
  application_id: string | null;
  action_type: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export const useClientActivities = (leadId?: string, applicationId?: string) => {
  return useQuery({
    queryKey: ['client-activities', leadId, applicationId],
    queryFn: async () => {
      let query = (supabase as any).from('client_activities').select('*').order('created_at', { ascending: false });
      
      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      if (applicationId) {
        query = query.eq('application_id', applicationId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('client_activities table not found:', error.message);
        return [];
      }
      return (data || []) as ClientActivity[];
    },
    enabled: !!(leadId || applicationId),
  });
};

export const useCreateClientActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activity: Omit<ClientActivity, 'id' | 'created_at'>) => {
      const { data, error } = await (supabase as any)
        .from('client_activities')
        .insert(activity)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-activities'] });
    },
    onError: (error: any) => {
      console.error('Failed to log activity:', error);
    },
  });
};
