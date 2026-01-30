import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Rental {
  id: string;
  vehicle_make_model: string;
  registration_number: string;
  vin_number: string | null;
  purchase_price: number;
  initial_recon_cost: number;
  renter_name: string | null;
  renter_contact: string | null;
  renter_id_number: string | null;
  monthly_rent: number;
  deposit_amount: number;
  payment_day: number;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface RentalLog {
  id: string;
  rental_id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  log_date: string;
  created_at: string;
}

export interface CreateRentalData {
  vehicle_make_model: string;
  registration_number: string;
  vin_number?: string;
  purchase_price?: number;
  initial_recon_cost?: number;
  renter_name?: string;
  renter_contact?: string;
  renter_id_number?: string;
  monthly_rent: number;
  deposit_amount?: number;
  payment_day?: number;
  start_date?: string;
  notes?: string;
}

export interface CreateRentalLogData {
  rental_id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  log_date?: string;
}

export const useRentals = () => {
  const queryClient = useQueryClient();

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ['rentals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rentals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Rental[];
    },
  });

  const createRental = useMutation({
    mutationFn: async (rental: CreateRentalData) => {
      const { data, error } = await supabase
        .from('rentals')
        .insert(rental)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      toast.success('Rental added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add rental: ' + error.message);
    },
  });

  const updateRental = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Rental> & { id: string }) => {
      const { data, error } = await supabase
        .from('rentals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      toast.success('Rental updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update rental: ' + error.message);
    },
  });

  const deleteRental = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rentals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      toast.success('Rental deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete rental: ' + error.message);
    },
  });

  return {
    rentals,
    isLoading,
    createRental,
    updateRental,
    deleteRental,
  };
};

export const useRentalLogs = (rentalId: string | null) => {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['rental-logs', rentalId],
    queryFn: async () => {
      if (!rentalId) return [];
      
      const { data, error } = await supabase
        .from('rental_logs')
        .select('*')
        .eq('rental_id', rentalId)
        .order('log_date', { ascending: false });

      if (error) throw error;
      return data as RentalLog[];
    },
    enabled: !!rentalId,
  });

  const createLog = useMutation({
    mutationFn: async (log: CreateRentalLogData) => {
      const { data, error } = await supabase
        .from('rental_logs')
        .insert(log)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-logs', rentalId] });
      toast.success('Log entry added');
    },
    onError: (error) => {
      toast.error('Failed to add log: ' + error.message);
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rental_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-logs', rentalId] });
      toast.success('Log entry deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete log: ' + error.message);
    },
  });

  const totalIncome = logs
    .filter(l => l.type === 'income')
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const totalExpenses = logs
    .filter(l => l.type === 'expense')
    .reduce((sum, l) => sum + Number(l.amount), 0);

  return {
    logs,
    isLoading,
    createLog,
    deleteLog,
    totalIncome,
    totalExpenses,
  };
};
