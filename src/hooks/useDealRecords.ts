import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AftersalesExpense {
  type: string;
  amount: number;
  description?: string;
}

export interface DealRecord {
  id: string;
  application_id: string | null;
  vehicle_id: string | null;
  sales_rep_name: string | null;
  sales_rep_commission: number | null;
  sold_price: number | null;
  sold_mileage: number | null;
  next_service_date: string | null;
  next_service_km: number | null;
  delivery_address: string | null;
  delivery_date: string | null;
  aftersales_expenses: AftersalesExpense[] | null;
  created_at: string;
  vehicle?: {
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    purchase_price?: number;
    reconditioning_cost?: number;
  };
  application?: {
    first_name: string | null;
    last_name: string | null;
    full_name: string;
    email: string;
    phone: string;
  };
}

export const useDealRecords = () => {
  return useQuery({
    queryKey: ['deal-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select(`
          *,
          vehicle:vehicles(make, model, variant, year, price, purchase_price, reconditioning_cost),
          application:finance_applications(first_name, last_name, full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DealRecord[];
    },
  });
};

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
  costPrice?: number;
  calculatedProfit?: number;
  isSourcingVehicle?: boolean;
}

export const useCreateDealRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: DealRecordInsert) => {
      // Insert deal record
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

      // If sourcing vehicle, increment sourced_count instead of marking sold
      if (record.isSourcingVehicle) {
        // Update sourced_count directly
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('sourced_count')
          .eq('id', record.vehicleId)
          .single();
        
        await supabase
          .from('vehicles')
          .update({ sourced_count: ((vehicle as any)?.sourced_count || 0) + 1 })
          .eq('id', record.vehicleId);
      }

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
