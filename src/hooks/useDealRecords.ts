import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AftersalesExpense {
  type: string;
  amount: number;
  description?: string;
}

export interface DealAddOnItem {
  name: string;
  cost: number;
  price: number;
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
  costPrice?: number;
  calculatedProfit?: number;
  isSourcingVehicle?: boolean;
  // Shared Capital fields
  isSharedCapital?: boolean;
  partnerSplitPercent?: number;
  partnerProfitAmount?: number;
  partnerSplitType?: 'percentage' | 'fixed';
  partnerSplitValue?: number;
  // F&I fields
  discountAmount?: number;
  dealerDepositContribution?: number;
  externalAdminFee?: number;
  bankInitiationFee?: number;
  totalFinancedAmount?: number;
  clientDeposit?: number;
  grossProfit?: number;
  reconCost?: number;
  // Add-ons
  addonsData?: DealAddOnItem[];
}

export const useCreateDealRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: DealRecordInsert) => {
      // Insert deal record - cast as any because new columns may not be in types yet
      const { data, error } = await (supabase as any)
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
          aftersales_expenses: record.aftersalesExpenses,
          // Cost and profit
          cost_price: record.costPrice || 0,
          gross_profit: record.grossProfit || 0,
          recon_cost: record.reconCost || 0,
          // Shared Capital fields
          is_shared_capital: record.isSharedCapital || false,
          partner_split_percent: record.partnerSplitPercent || 0,
          partner_profit_amount: record.partnerProfitAmount || 0,
          partner_split_type: record.partnerSplitType || 'percentage',
          partner_split_value: record.partnerSplitValue || 0,
          // F&I fields
          discount_amount: record.discountAmount || 0,
          dealer_deposit_contribution: record.dealerDepositContribution || 0,
          external_admin_fee: record.externalAdminFee || 0,
          bank_initiation_fee: record.bankInitiationFee || 0,
          total_financed_amount: record.totalFinancedAmount || 0,
          client_deposit: record.clientDeposit || 0,
          // Add-ons
          addons_data: record.addonsData || [],
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
