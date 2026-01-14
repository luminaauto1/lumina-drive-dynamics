import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SiteSettings {
  id: string;
  default_interest_rate: number;
  min_balloon_percent: number;
  max_balloon_percent: number;
  show_finance_tab: boolean;
  is_maintenance_mode: boolean;
  hero_headline: string;
  hero_subheadline: string;
  primary_phone: string;
  secondary_phone: string | null;
  primary_email: string;
  finance_email: string;
  contact_phone: string;
  contact_email: string;
  whatsapp_number: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string | null;
  show_physical_location: boolean;
  physical_address: string | null;
  min_interest: number | null;
  max_interest: number | null;
  min_deposit_percent: number | null;
  sales_reps: { name: string; commission: number }[] | null;
}

interface SiteSettingsLegacy {
  id: string;
  default_interest_rate: number;
  min_balloon_percent: number;
  max_balloon_percent: number;
  contact_phone: string;
  contact_email: string;
  whatsapp_number: string;
  facebook_url: string;
  instagram_url: string;
  hero_headline: string;
  hero_subheadline: string;
  is_maintenance_mode: boolean;
  // New fields
  primary_phone: string;
  secondary_phone: string | null;
  primary_email: string;
  finance_email: string;
  show_physical_location: boolean;
  physical_address: string | null;
  show_finance_tab: boolean;
  created_at: string;
  updated_at: string;
}

export const useSiteSettings = () => {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data as unknown as SiteSettings;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

export const useUpdateSiteSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<SiteSettings>) => {
      // Get the single settings row
      const { data: existingSettings } = await supabase
        .from('site_settings')
        .select('id')
        .limit(1)
        .single();

      if (!existingSettings) {
        throw new Error('No settings row found');
      }

      const { data, error } = await supabase
        .from('site_settings')
        .update(updates)
        .eq('id', existingSettings.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SiteSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast.error('Failed to save settings');
    },
  });
};
