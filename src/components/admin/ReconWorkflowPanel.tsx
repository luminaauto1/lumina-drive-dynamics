import { useState } from 'react';
import { Plus, Trash2, Check, Clock, Loader2, Wrench, Sparkles, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useInventoryTasks, useCreateInventoryTask, useUpdateInventoryTask, useDeleteInventoryTask, InventoryTask } from '@/hooks/useInventoryTasks';
import { formatPrice } from '@/hooks/useVehicles';

interface ReconWorkflowPanelProps {
  vehicleId: string;
  purchasePrice: number;
  sellingPrice: number;
}

const RECON_STAGES = [
  { stage: 1, name: 'Mechanical', icon: Wrench, color: 'text-blue-400' },
  { stage: 2, name: 'Aesthetic', icon: Sparkles, color: 'text-purple-400' },
  { stage: 3, name: 'Valet', icon: Car, color: 'text-emerald-400' },
];

const ReconWorkflowPanel = ({ vehicleId, purchasePrice, sellingPrice }: ReconWorkflowPanelProps) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCost, setNewTaskCost] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  const { data: tasks = [], isLoading } = useInventoryTasks(vehicleId);
  const createTask = useCreateInventoryTask();
  const updateTask = useUpdateInventoryTask();
  const deleteTask = useDeleteInventoryTask();

  const totalReconCost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
  const totalCost = purchasePrice + totalReconCost;
  const estimatedMargin = sellingPrice - totalCost;
  const marginPercent = sellingPrice > 0 ? ((estimatedMargin / sellingPrice) * 100).toFixed(1) : '0';

  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    
    await createTask.mutateAsync({
      vehicle_id: vehicleId,
      task_name: newTaskName,
      cost: parseFloat(newTaskCost) || 0,
    });
    
    setNewTaskName('');
    setNewTaskCost('');
    setIsAddingTask(false);
  };

  const handleStatusChange = async (task: InventoryTask, newStatus: string) => {
    await updateTask.mutateAsync({
      id: task.id,
      updates: { status: newStatus as any },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Check className="w-3 h-3 mr-1" /> Done</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress</Badge>;
      default:
        return <Badge className="bg-secondary text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profit Preview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-secondary/50">
          <p className="text-xs text-muted-foreground mb-1">Total Cost</p>
          <p className="font-semibold">{formatPrice(totalCost)}</p>
          <p className="text-xs text-muted-foreground">
            {formatPrice(purchasePrice)} + {formatPrice(totalReconCost)} recon
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50">
          <p className="text-xs text-muted-foreground mb-1">Selling Price</p>
          <p className="font-semibold">{formatPrice(sellingPrice)}</p>
        </div>
        <div className={`p-3 rounded-lg ${estimatedMargin >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          <p className="text-xs text-muted-foreground mb-1">Est. Margin</p>
          <p className={`font-bold ${estimatedMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPrice(estimatedMargin)}
          </p>
          <p className="text-xs text-muted-foreground">{marginPercent}%</p>
        </div>
      </div>

      {/* Recon Stages Overview */}
      <div className="flex gap-2">
        {RECON_STAGES.map((stage) => {
          const stageTasks = tasks.filter(t => t.task_name.toLowerCase().includes(stage.name.toLowerCase()));
          const completed = stageTasks.every(t => t.status === 'completed');
          const hasAny = stageTasks.length > 0;
          
          return (
            <div 
              key={stage.stage}
              className={`flex-1 p-3 rounded-lg border ${
                completed && hasAny 
                  ? 'border-emerald-500/30 bg-emerald-500/10' 
                  : 'border-border bg-secondary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <stage.icon className={`w-4 h-4 ${stage.color}`} />
                <span className="text-xs font-medium">Stage {stage.stage}</span>
              </div>
              <p className="text-sm">{stage.name}</p>
            </div>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Recon Tasks</h4>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsAddingTask(!isAddingTask)}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Task
          </Button>
        </div>

        {/* Add Task Form */}
        {isAddingTask && (
          <div className="flex gap-2 p-3 rounded-lg bg-secondary/50 mb-3">
            <Input
              placeholder="Task description"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Cost (R)"
              value={newTaskCost}
              onChange={(e) => setNewTaskCost(e.target.value)}
              className="w-28"
            />
            <Button onClick={handleAddTask} disabled={!newTaskName.trim() || createTask.isPending}>
              {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </Button>
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">No recon tasks added yet</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 group"
              >
                <div className="flex items-center gap-3">
                  <Select 
                    value={task.status} 
                    onValueChange={(v) => handleStatusChange(task, v)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm">{task.task_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{formatPrice(task.cost)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteTask.mutate(task.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReconWorkflowPanel;
