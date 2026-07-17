// Invoice history for the /admin/invoices tool. Every generated invoice's full
// form state is persisted (payload jsonb) so it can be re-downloaded byte-alike
// or duplicated as a new draft. RLS: admin / accountant / F&I / senior F&I.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  kind: 'vehicle' | 'general';
  bill_to_name: string;
  grand_total: number;
  payload: Record<string, any>;
  created_at: string;
}

export const useInvoices = () =>
  useQuery({
    queryKey: ['invoices'],
    queryFn: async (): Promise<InvoiceRow[]> => {
      // Cast: invoices is a newly-added table not yet in generated types.
      const { data, error } = await (supabase as any)
        .from('invoices')
        .select('id, invoice_number, invoice_date, kind, bill_to_name, grand_total, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    },
  });

export const useInsertInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<InvoiceRow, 'id' | 'created_at'>) => {
      const { error } = await (supabase as any).from('invoices').insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

/** Update an existing invoice in place (owner 2026-07-17: "go back and edit
 *  invoices"). The invoice number is preserved by the caller; only the
 *  editable fields + the full payload change. */
export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: Partial<Omit<InvoiceRow, 'created_at'>> & { id: string }) => {
      const { error } = await (supabase as any).from('invoices').update(row).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};
