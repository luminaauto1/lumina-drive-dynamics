import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, CheckCircle2, Circle, Loader2, ClipboardList } from 'lucide-react';
import { 
  useDeliveryTasks, 
  useCreateDeliveryTask, 
  useToggleDeliveryTask, 
  useDeleteDeliveryTask,
  useInitializeDeliveryTasks 
} from '@/hooks/useDeliveryTasks';
import { cn } from '@/lib/utils';

interface DeliveryChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  clientName: string;
}

const DeliveryChecklistModal = ({ 
  open, 
  onOpenChange, 
  applicationId, 
  clientName 
}: DeliveryChecklistModalProps) => {
  const [newTaskName, setNewTaskName] = useState('');
  
  const { data: tasks = [], isLoading } = useDeliveryTasks(applicationId);
  const createTask = useCreateDeliveryTask();
  const toggleTask = useToggleDeliveryTask();
  const deleteTask = useDeleteDeliveryTask();
  const initializeTasks = useInitializeDeliveryTasks();

  // Initialize default tasks when modal opens
  useEffect(() => {
    if (open && applicationId && tasks.length === 0 && !isLoading) {
      initializeTasks.mutate(applicationId);
    }
  }, [open, applicationId, tasks.length, isLoading]);

  const completedCount = tasks.filter(t => t.is_completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    createTask.mutate({ applicationId, taskName: newTaskName.trim() });
    setNewTaskName('');
  };

  const handleToggle = (taskId: string, currentState: boolean) => {
    toggleTask.mutate({ taskId, isCompleted: !currentState, applicationId });
  };

  const handleDelete = (taskId: string) => {
    deleteTask.mutate({ taskId, applicationId });
  };

  const getProgressColor = () => {
    if (progressPercent === 100) return 'bg-emerald-500';
    if (progressPercent >= 80) return 'bg-green-500';
    if (progressPercent >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Delivery Prep: {clientName}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Section */}
        <div className="space-y-2 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ready for Delivery</span>
            <span className={cn(
              "font-bold",
              progressPercent === 100 ? "text-emerald-400" : "text-foreground"
            )}>
              {progressPercent}%
            </span>
          </div>
          <div className="relative">
            <Progress value={progressPercent} className="h-3" />
            <div 
              className={cn("absolute top-0 left-0 h-full rounded-full transition-all", getProgressColor())}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {totalCount} tasks completed
          </p>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tasks yet. Initializing...</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all",
                  task.is_completed 
                    ? "bg-emerald-500/10 border-emerald-500/30" 
                    : "bg-white/5 border-white/10 hover:border-white/20"
                )}
              >
                <button
                  onClick={() => handleToggle(task.id, task.is_completed)}
                  className="flex-shrink-0"
                >
                  {task.is_completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <span className={cn(
                  "flex-1 text-sm",
                  task.is_completed && "line-through text-muted-foreground"
                )}>
                  {task.task_name}
                </span>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="flex-shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Custom Task */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex gap-2">
            <Input
              placeholder="Add custom task..."
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="flex-1"
            />
            <Button 
              onClick={handleAddTask} 
              disabled={!newTaskName.trim() || createTask.isPending}
              size="icon"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Footer */}
        {progressPercent === 100 && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-center">
            <p className="text-emerald-400 font-medium">
              🎉 Vehicle is ready for delivery!
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryChecklistModal;
