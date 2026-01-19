import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InventoryTask {
  id: string;
  vehicle_id: string;
  task_name: string;
  cost: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

export const useInventoryTasks = (vehicleId?: string) => {
  return useQuery({
    queryKey: ['inventory-tasks', vehicleId],
    queryFn: async () => {
      // Table may not exist yet - use dynamic query
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: true });
      
      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []) as InventoryTask[];
    },
    enabled: !!vehicleId,
  });
};

export const useAllInventoryTasks = () => {
  return useQuery({
    queryKey: ['inventory-tasks-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []) as InventoryTask[];
    },
  });
};

export const useCreateInventoryTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (task: { vehicle_id: string; task_name: string; cost: number }) => {
      const { data, error } = await (supabase as any)
        .from('inventory_tasks')
        .insert(task)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks', variables.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks-all'] });
      toast.success('Task added');
    },
    onError: () => {
      toast.error('Failed to add task');
    },
  });
};

export const useUpdateInventoryTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InventoryTask> }) => {
      const { error } = await (supabase as any)
        .from('inventory_tasks')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks-all'] });
      toast.success('Task updated');
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });
};

export const useDeleteInventoryTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('inventory_tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks-all'] });
      toast.success('Task removed');
    },
    onError: () => {
      toast.error('Failed to remove task');
    },
  });
};
