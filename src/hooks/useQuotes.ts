import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { QuoteData, QuoteRecord } from '@/features/quote/types';
import { calcQuote } from '@/features/quote/calc';

// Denormalised columns for the list view (kept in sync on every write).
const summarize = (data: QuoteData) => ({
  client_name: data.client?.name || null,
  vehicle:
    [data.vehicle?.make, data.vehicle?.model, data.vehicle?.year].filter(Boolean).join(' ') || null,
  total: calcQuote(data).total,
  valid_until: data.quote?.valid_until_iso || null,
});

export const useQuotes = () =>
  useQuery({
    queryKey: ['quotes'],
    queryFn: async (): Promise<QuoteRecord[]> => {
      // Cast: `quotes` is a newly-added table not yet in the generated Supabase types.
      const { data, error } = await (supabase as any)
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as QuoteRecord[];
    },
  });

export const useCreateQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ref: string; data: QuoteData }): Promise<QuoteRecord> => {
      const { data: userData } = await supabase.auth.getUser();
      const row = {
        ref: payload.ref,
        data: payload.data,
        ...summarize(payload.data),
        created_by: userData?.user?.id ?? null,
      };
      const { data, error } = await (supabase as any).from('quotes').insert(row).select().single();
      if (error) throw error;
      return data as QuoteRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

export const useUpdateQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; data: QuoteData }): Promise<void> => {
      const { error } = await (supabase as any)
        .from('quotes')
        .update({ data: payload.data, ...summarize(payload.data) })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

export const useDeleteQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await (supabase as any).from('quotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    onError: (e: any) => toast.error('Delete failed: ' + e.message),
  });
};
