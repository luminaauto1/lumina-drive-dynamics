import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientActivity {
  id: string;
  lead_id: string | null;
  application_id: string | null;
  action_type: 'status_change' | 'note' | 'view_vehicle' | 'system' | 'addon_added' | 'document_uploaded';
  details: string | null;
  admin_id: string | null;
  created_at: string;
}

export const useClientActivities = (applicationId?: string, leadId?: string) => {
  return useQuery({
    queryKey: ['client-activities', applicationId, leadId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('client_activities')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (applicationId) {
        query = query.eq('application_id', applicationId);
      }
      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      
      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []) as ClientActivity[];
    },
    enabled: !!applicationId || !!leadId,
  });
};

export const useLogClientActivity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (activity: {
      lead_id?: string | null;
      application_id?: string | null;
      action_type: string;
      details?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await (supabase as any)
        .from('client_activities')
        .insert({
          ...activity,
          admin_id: user?.id || null,
        });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-activities', variables.application_id, variables.lead_id] });
    },
  });
};
