import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VehicleExpense {
  id: string;
  vehicle_id: string;
  description: string;
  amount: number;
  category: string;
  receipt_url: string | null;
  date_incurred: string;
  created_at: string;
}

export const EXPENSE_CATEGORIES = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'toll', label: 'Toll Fees' },
  { value: 'parts', label: 'Parts' },
  { value: 'labor', label: 'Labor' },
  { value: 'transport', label: 'Transport' },
  { value: 'cleaning', label: 'Cleaning/Valet' },
  { value: 'general', label: 'General' },
] as const;

export const useVehicleExpenses = (vehicleId?: string) => {
  return useQuery({
    queryKey: ['vehicle-expenses', vehicleId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('vehicle_expenses')
        .select('*')
        .order('date_incurred', { ascending: false });
      
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VehicleExpense[];
    },
    enabled: !!vehicleId,
  });
};

export const useCreateVehicleExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: Omit<VehicleExpense, 'id' | 'created_at'>) => {
      const { data, error } = await (supabase as any)
        .from('vehicle_expenses')
        .insert(expense)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-expenses', variables.vehicle_id] });
      toast.success('Expense added');
    },
    onError: (error: any) => {
      toast.error('Failed to add expense: ' + error.message);
    },
  });
};

export const useUpdateVehicleExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<VehicleExpense> }) => {
      const { data, error } = await (supabase as any)
        .from('vehicle_expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-expenses'] });
      toast.success('Expense updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update expense: ' + error.message);
    },
  });
};

export const useDeleteVehicleExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('vehicle_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-expenses'] });
      toast.success('Expense deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete expense: ' + error.message);
    },
  });
};

// Calculate total expenses for a vehicle
export const useTotalVehicleExpenses = (vehicleId?: string) => {
  return useQuery({
    queryKey: ['vehicle-expenses-total', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return 0;
      
      const { data, error } = await (supabase as any)
        .from('vehicle_expenses')
        .select('amount')
        .eq('vehicle_id', vehicleId);

      if (error) {
        console.warn('vehicle_expenses table not found:', error.message);
        return 0;
      }
      
      return data?.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) || 0;
    },
    enabled: !!vehicleId,
  });
};
