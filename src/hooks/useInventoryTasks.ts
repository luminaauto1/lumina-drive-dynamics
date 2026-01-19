import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InventoryTask {
  id: string;
  vehicle_id: string;
  task_name: string;
  category: 'mechanical' | 'aesthetic' | 'valet' | 'admin';
  cost: number;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export const useInventoryTasks = (vehicleId?: string) => {
  return useQuery({
    queryKey: ['inventory-tasks', vehicleId],
    queryFn: async () => {
      let query = (supabase as any).from('inventory_tasks').select('*').order('created_at', { ascending: false });
      
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as InventoryTask[];
    },
  });
};

export const useAllPendingTasks = () => {
  return useQuery({
    queryKey: ['inventory-tasks', 'pending'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .select('*, vehicles(id, make, model, year, status)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateInventoryTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<InventoryTask, 'id' | 'created_at' | 'completed_at'>) => {
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .insert(task)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks'] });
      toast.success('Task added');
    },
    onError: (error: any) => {
      toast.error('Failed to add task: ' + error.message);
    },
  });
};

export const useUpdateInventoryTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InventoryTask> }) => {
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .update({
          ...updates,
          completed_at: updates.status === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks'] });
      toast.success('Task updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update task: ' + error.message);
    },
  });
};

export const useDeleteInventoryTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('inventory_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks'] });
      toast.success('Task deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete task: ' + error.message);
    },
  });
};

// Calculate total recon liability (pending tasks for unsold vehicles)
export const useReconLiability = () => {
  return useQuery({
    queryKey: ['recon-liability'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .select('cost, vehicles!inner(status)')
        .eq('status', 'pending')
        .neq('vehicles.status', 'sold');

      if (error) {
        // Table might not exist yet
        console.warn('inventory_tasks table not found:', error.message);
        return 0;
      }
      
      const total = data?.reduce((sum: number, task: any) => sum + (task.cost || 0), 0) || 0;
      return total;
    },
  });
};
