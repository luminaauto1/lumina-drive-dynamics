import { useState } from 'react';
import { Plus, Trash2, Check, Wrench, Sparkles, CarFront, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/hooks/useVehicles';
import { useInventoryTasks, useCreateInventoryTask, useUpdateInventoryTask, useDeleteInventoryTask, InventoryTask } from '@/hooks/useInventoryTasks';

interface ReconTasksTabProps {
  vehicleId: string;
  purchasePrice: number;
  sellingPrice: number;
}

const CATEGORY_CONFIG = {
  mechanical: { label: 'Mechanical', icon: Wrench, color: 'text-blue-400 bg-blue-500/20' },
  aesthetic: { label: 'Aesthetic', icon: Sparkles, color: 'text-purple-400 bg-purple-500/20' },
  valet: { label: 'Valet', icon: CarFront, color: 'text-emerald-400 bg-emerald-500/20' },
  admin: { label: 'Admin', icon: FileText, color: 'text-amber-400 bg-amber-500/20' },
};

const ReconTasksTab = ({ vehicleId, purchasePrice, sellingPrice }: ReconTasksTabProps) => {
  const [newTask, setNewTask] = useState<{ task_name: string; category: 'mechanical' | 'aesthetic' | 'valet' | 'admin'; cost: number }>({ task_name: '', category: 'mechanical', cost: 0 });
  
  const { data: tasks = [] } = useInventoryTasks(vehicleId);
  const createTask = useCreateInventoryTask();
  const updateTask = useUpdateInventoryTask();
  const deleteTask = useDeleteInventoryTask();

  const handleAddTask = async () => {
    if (!newTask.task_name.trim()) return;
    
    await createTask.mutateAsync({
      vehicle_id: vehicleId,
      task_name: newTask.task_name,
      category: newTask.category,
      cost: newTask.cost,
      status: 'pending',
    });
    
    setNewTask({ task_name: '', category: 'mechanical', cost: 0 });
  };

  const toggleTaskStatus = async (task: InventoryTask) => {
    await updateTask.mutateAsync({
      id: task.id,
      updates: { status: task.status === 'pending' ? 'done' : 'pending' },
    });
  };

  const totalReconCost = tasks.reduce((sum, task) => sum + (task.cost || 0), 0);
  const pendingReconCost = tasks.filter(t => t.status === 'pending').reduce((sum, task) => sum + (task.cost || 0), 0);
  const trueCost = purchasePrice + totalReconCost;
  const projectedProfit = sellingPrice - trueCost;

  return (
    <div className="space-y-6">
      {/* Add Task Form */}
      <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
        <h4 className="font-medium text-sm">Add Reconditioning Task</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input 
            placeholder="Task name (e.g. Brake Pads)"
            value={newTask.task_name}
            onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })}
            className="sm:col-span-2"
          />
          <Select 
            value={newTask.category} 
            onValueChange={(value: 'mechanical' | 'aesthetic' | 'valet' | 'admin') => 
              setNewTask({ ...newTask, category: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mechanical">Mechanical</SelectItem>
              <SelectItem value="aesthetic">Aesthetic</SelectItem>
              <SelectItem value="valet">Valet</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Input 
            type="number"
            placeholder="Cost (R)"
            value={newTask.cost || ''}
            onChange={(e) => setNewTask({ ...newTask, cost: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <Button onClick={handleAddTask} size="sm" disabled={!newTask.task_name.trim()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recon tasks yet</p>
            <p className="text-sm">Add tasks like brake pads, dent removal, etc.</p>
          </div>
        ) : (
          tasks.map((task) => {
            const config = CATEGORY_CONFIG[task.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.mechanical;
            const Icon = config.icon;
            
            return (
              <div 
                key={task.id} 
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  task.status === 'done' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleTaskStatus(task)}
                    className={task.status === 'done' ? 'text-emerald-400' : 'text-muted-foreground'}
                  >
                    <Check className={`w-5 h-5 ${task.status === 'done' ? 'opacity-100' : 'opacity-30'}`} />
                  </Button>
                  <Badge variant="outline" className={config.color}>
                    <Icon className="w-3 h-3 mr-1" />
                    {config.label}
                  </Badge>
                  <span className={task.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                    {task.task_name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatPrice(task.cost)}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => deleteTask.mutate(task.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Separator />

      {/* Cost Roll-up Summary */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Cost Analysis</h4>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
            <span className="text-sm">Purchase Price</span>
            <span className="font-medium">{formatPrice(purchasePrice)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
            <span className="text-sm">Total Recon Costs</span>
            <span className="font-medium text-amber-400">+{formatPrice(totalReconCost)}</span>
          </div>
          {pendingReconCost > 0 && (
            <div className="flex justify-between items-center p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <span className="text-sm">Pending Recon</span>
              <span className="font-medium text-amber-400">{formatPrice(pendingReconCost)}</span>
            </div>
          )}
          <div className="flex justify-between items-center p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <span className="text-sm font-medium">True Cost / Burden</span>
            <span className="font-bold text-blue-400">{formatPrice(trueCost)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
          <span className="text-sm">Selling Price</span>
          <span className="font-medium">{formatPrice(sellingPrice)}</span>
        </div>
        
        <div className={`flex justify-between items-center p-4 rounded-lg ${
          projectedProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'
        }`}>
          <span className="font-semibold">Projected Profit</span>
          <span className={`text-xl font-bold ${projectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPrice(projectedProfit)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReconTasksTab;
