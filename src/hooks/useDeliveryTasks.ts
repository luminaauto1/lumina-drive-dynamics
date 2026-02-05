import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryTask {
  id: string;
  application_id: string;
  task_name: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// Default delivery tasks
export const DEFAULT_DELIVERY_TASKS = [
  'PDI (Pre-Delivery Inspection)',
  'Full Vehicle Wash & Detail',
  'Champagne & Welcome Gift',
  'Registration Papers Ready',
  'Spare Keys Checked',
  'Owner\'s Manual & Service Book',
  'Fuel Tank Filled',
  'Insurance Confirmation',
];

export const useDeliveryTasks = (applicationId: string) => {
  return useQuery({
    queryKey: ['delivery-tasks', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as DeliveryTask[];
    },
    enabled: !!applicationId,
  });
};

export const useCreateDeliveryTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, taskName }: { applicationId: string; taskName: string }) => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .insert({
          application_id: applicationId,
          task_name: taskName,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tasks', variables.applicationId] });
    },
    onError: (error) => {
      toast.error('Failed to add task: ' + error.message);
    },
  });
};

export const useToggleDeliveryTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, isCompleted, applicationId }: { taskId: string; isCompleted: boolean; applicationId: string }) => {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tasks', variables.applicationId] });
    },
    onError: (error) => {
      toast.error('Failed to update task: ' + error.message);
    },
  });
};

export const useDeleteDeliveryTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, applicationId }: { taskId: string; applicationId: string }) => {
      const { error } = await supabase
        .from('delivery_tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tasks', variables.applicationId] });
    },
    onError: (error) => {
      toast.error('Failed to delete task: ' + error.message);
    },
  });
};

export const useInitializeDeliveryTasks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      // Check if tasks already exist
      const { data: existing } = await supabase
        .from('delivery_tasks')
        .select('id')
        .eq('application_id', applicationId)
        .limit(1);
      
      if (existing && existing.length > 0) {
        return existing; // Already initialized
      }

      // Create default tasks
      const tasksToInsert = DEFAULT_DELIVERY_TASKS.map(taskName => ({
        application_id: applicationId,
        task_name: taskName,
      }));

      const { data, error } = await supabase
        .from('delivery_tasks')
        .insert(tasksToInsert)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tasks', applicationId] });
    },
    onError: (error) => {
      toast.error('Failed to initialize tasks: ' + error.message);
    },
  });
};
