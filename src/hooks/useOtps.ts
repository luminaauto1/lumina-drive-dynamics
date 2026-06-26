import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OtpData, OtpRecord } from '@/features/otp/types';
import { calcOtp } from '@/features/otp/calc';

// Denormalised columns for the list view (kept in sync on every write).
const summarize = (data: OtpData) => ({
  client_name: data.client?.name || null,
  vehicle:
    [data.vehicle?.make, data.vehicle?.model, data.vehicle?.year].filter(Boolean).join(' ') || null,
  balance: calcOtp(data).balance,
});

export const useOtps = () =>
  useQuery({
    queryKey: ['otps'],
    queryFn: async (): Promise<OtpRecord[]> => {
      // Cast: `otps` is a newly-added table not yet in the generated Supabase types.
      const { data, error } = await (supabase as any)
        .from('otps')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OtpRecord[];
    },
  });

export const useCreateOtp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ref: string; data: OtpData }): Promise<OtpRecord> => {
      const { data: userData } = await supabase.auth.getUser();
      const row = {
        ref: payload.ref,
        data: payload.data,
        ...summarize(payload.data),
        created_by: userData?.user?.id ?? null,
      };
      const { data, error } = await (supabase as any).from('otps').insert(row).select().single();
      if (error) throw error;
      return data as OtpRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['otps'] }),
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

export const useUpdateOtp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; data: OtpData }): Promise<void> => {
      const { error } = await (supabase as any)
        .from('otps')
        .update({ data: payload.data, ...summarize(payload.data) })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['otps'] }),
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

export const useDeleteOtp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await (supabase as any).from('otps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['otps'] }),
    onError: (e: any) => toast.error('Delete failed: ' + e.message),
  });
};
