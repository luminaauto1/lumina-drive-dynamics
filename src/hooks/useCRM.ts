import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CRMProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  internal_status: string;
  admin_notes: string | null;
  last_contacted_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  // Aggregated data
  finance_applications: {
    id: string;
    status: string;
    created_at: string;
    vehicle_id: string | null;
  }[];
  wishlist_count: number;
  leads: {
    id: string;
    source: string;
    status: string;
    vehicle_id: string | null;
    notes: string | null;
    created_at: string;
  }[];
}

export interface LeadNote {
  id: string;
  profile_id: string;
  admin_id: string;
  content: string;
  created_at: string;
}

export const useCRM = () => {
  return useQuery({
    queryKey: ['crm-profiles'],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all finance applications
      const { data: applications, error: appError } = await supabase
        .from('finance_applications')
        .select('id, status, created_at, vehicle_id, user_id');

      if (appError) throw appError;

      // Fetch wishlist counts
      const { data: wishlists, error: wishlistError } = await supabase
        .from('wishlists')
        .select('user_id, id');

      if (wishlistError) throw wishlistError;

      // Fetch leads by email matching
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, source, status, vehicle_id, notes, created_at, client_email');

      if (leadsError) throw leadsError;

      // Aggregate data for each profile
      const crmProfiles: CRMProfile[] = (profiles || []).map((profile: any) => {
        const userApplications = (applications || []).filter(
          (app: any) => app.user_id === profile.user_id
        );
        
        const userWishlistCount = (wishlists || []).filter(
          (w: any) => w.user_id === profile.user_id
        ).length;

        const userLeads = (leads || []).filter(
          (lead: any) => lead.client_email?.toLowerCase() === profile.email?.toLowerCase()
        );

        return {
          ...profile,
          finance_applications: userApplications.map((app: any) => ({
            id: app.id,
            status: app.status,
            created_at: app.created_at,
            vehicle_id: app.vehicle_id,
          })),
          wishlist_count: userWishlistCount,
          leads: userLeads.map((lead: any) => ({
            id: lead.id,
            source: lead.source,
            status: lead.status,
            vehicle_id: lead.vehicle_id,
            notes: lead.notes,
            created_at: lead.created_at,
          })),
        };
      });

      return crmProfiles;
    },
  });
};

export const useUpdateCRMProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<{
        internal_status: string;
        admin_notes: string;
        last_contacted_at: string;
      }>;
    }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-profiles'] });
      toast.success('Profile updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update profile: ' + error.message);
    },
  });
};

export const useLeadNotes = (profileId?: string) => {
  return useQuery({
    queryKey: ['lead-notes', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('lead_notes table error:', error.message);
        return [];
      }
      return (data || []) as LeadNote[];
    },
    enabled: !!profileId,
  });
};

export const useCreateLeadNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      profile_id, 
      content 
    }: { 
      profile_id: string; 
      content: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('lead_notes')
        .insert({
          profile_id,
          admin_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-notes'] });
      toast.success('Note added');
    },
    onError: (error: any) => {
      toast.error('Failed to add note: ' + error.message);
    },
  });
};

export const useProfileWishlist = (userId?: string) => {
  return useQuery({
    queryKey: ['profile-wishlist', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          id,
          vehicle_id,
          created_at,
          vehicle:vehicles(id, make, model, year, price, images, status)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};

export const useProfileApplications = (userId?: string) => {
  return useQuery({
    queryKey: ['profile-applications', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('finance_applications')
        .select(`
          id,
          status,
          created_at,
          full_name,
          email,
          phone,
          approved_budget,
          vehicle:vehicles(id, make, model, year, price)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};
