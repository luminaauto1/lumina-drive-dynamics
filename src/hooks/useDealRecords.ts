import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AftersalesExpense {
  type: string;
  amount: number;
  description?: string;
}

export interface DealRecordInsert {
  applicationId: string;
  vehicleId: string;
  salesRepName: string;
  salesRepCommission: number;
  soldPrice: number;
  soldMileage: number;
  nextServiceDate?: string;
  nextServiceKm?: number;
  deliveryAddress: string;
  deliveryDate: string;
  aftersalesExpenses: AftersalesExpense[];
}

export const useCreateDealRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: DealRecordInsert) => {
      const { data, error } = await supabase
        .from('deal_records')
        .insert({
          application_id: record.applicationId,
          vehicle_id: record.vehicleId,
          sales_rep_name: record.salesRepName,
          sales_rep_commission: record.salesRepCommission,
          sold_price: record.soldPrice,
          sold_mileage: record.soldMileage,
          next_service_date: record.nextServiceDate || null,
          next_service_km: record.nextServiceKm || null,
          delivery_address: record.deliveryAddress,
          delivery_date: record.deliveryDate,
          aftersales_expenses: record.aftersalesExpenses as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-records'] });
      toast.success('Deal record created');
    },
    onError: (error: any) => {
      console.error('Error creating deal record:', error);
      toast.error('Failed to create deal record');
    },
  });
};
