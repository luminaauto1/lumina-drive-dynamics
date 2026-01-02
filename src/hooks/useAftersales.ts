import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateAftersalesRecord {
  vehicleId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  financeApplicationId?: string;
}

export const useCreateAftersalesRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAftersalesRecord) => {
      const { error } = await supabase
        .from('aftersales_records')
        .insert({
          vehicle_id: data.vehicleId,
          customer_id: data.customerId,
          customer_name: data.customerName,
          customer_email: data.customerEmail || null,
          customer_phone: data.customerPhone || null,
          finance_application_id: data.financeApplicationId || null,
          sale_date: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aftersales-records'] });
      toast.success('Aftersales record created');
    },
    onError: (error) => {
      console.error('Error creating aftersales record:', error);
      toast.error('Failed to create aftersales record');
    },
  });
};
