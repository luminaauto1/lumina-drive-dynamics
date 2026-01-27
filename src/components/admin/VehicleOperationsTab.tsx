import { useState, useCallback } from 'react';
import { Plus, Trash2, Check, Wrench, Sparkles, CarFront, FileText, Receipt, Upload, Fuel, MapPin, Package, Scissors, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice } from '@/hooks/useVehicles';
import { useInventoryTasks, useCreateInventoryTask, useUpdateInventoryTask, useDeleteInventoryTask, InventoryTask } from '@/hooks/useInventoryTasks';
import { useVehicleExpenses, useCreateVehicleExpense, useDeleteVehicleExpense, VehicleExpense, EXPENSE_CATEGORIES } from '@/hooks/useVehicleExpenses';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VehicleOperationsTabProps {
  vehicleId: string;
  purchasePrice: number;
  sellingPrice: number;
}

const TASK_CATEGORY_CONFIG = {
  mechanical: { label: 'Mechanical', icon: Wrench, color: 'text-blue-400 bg-blue-500/20' },
  aesthetic: { label: 'Aesthetic', icon: Sparkles, color: 'text-purple-400 bg-purple-500/20' },
  valet: { label: 'Valet', icon: CarFront, color: 'text-emerald-400 bg-emerald-500/20' },
  admin: { label: 'Admin', icon: FileText, color: 'text-amber-400 bg-amber-500/20' },
};

const EXPENSE_CATEGORY_ICONS: Record<string, React.ElementType> = {
  fuel: Fuel,
  toll: MapPin,
  parts: Package,
  labor: Wrench,
  transport: CarFront,
  cleaning: Scissors,
  general: Receipt,
};

const VehicleOperationsTab = ({ vehicleId, purchasePrice, sellingPrice }: VehicleOperationsTabProps) => {
  const [activeSection, setActiveSection] = useState<'recon' | 'expenses'>('recon');
  
  // Recon Tasks State
  const [newTask, setNewTask] = useState<{ task_name: string; category: 'mechanical' | 'aesthetic' | 'valet' | 'admin'; cost: number }>({ 
    task_name: '', category: 'mechanical', cost: 0 
  });
  
  // Expense State
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<{
    description: string;
    amount: number;
    category: string;
    date_incurred: string;
    receipt_url: string | null;
  }>({
    description: '',
    amount: 0,
    category: 'general',
    date_incurred: new Date().toISOString().split('T')[0],
    receipt_url: null,
  });
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  
  // Hooks
  const { data: tasks = [] } = useInventoryTasks(vehicleId);
  const createTask = useCreateInventoryTask();
  const updateTask = useUpdateInventoryTask();
  const deleteTask = useDeleteInventoryTask();
  
  const { data: expenses = [] } = useVehicleExpenses(vehicleId);
  const createExpense = useCreateVehicleExpense();
  const deleteExpense = useDeleteVehicleExpense();

  // Task Handlers
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

  // Expense Handlers
  const handleReceiptUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReceipt(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${vehicleId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vehicle-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-images')
        .getPublicUrl(filePath);

      setNewExpense(prev => ({ ...prev, receipt_url: publicUrl }));
      toast.success('Receipt uploaded');
    } catch (error: any) {
      toast.error('Failed to upload receipt: ' + error.message);
    } finally {
      setIsUploadingReceipt(false);
    }
  }, [vehicleId]);

  const handleAddExpense = async () => {
    if (!newExpense.description.trim() || newExpense.amount <= 0) {
      toast.error('Please enter description and amount');
      return;
    }

    await createExpense.mutateAsync({
      vehicle_id: vehicleId,
      description: newExpense.description,
      amount: newExpense.amount,
      category: newExpense.category,
      date_incurred: newExpense.date_incurred,
      receipt_url: newExpense.receipt_url,
    });

    setNewExpense({
      description: '',
      amount: 0,
      category: 'general',
      date_incurred: new Date().toISOString().split('T')[0],
      receipt_url: null,
    });
    setExpenseDialogOpen(false);
  };

  // Calculations
  const totalReconCost = tasks.reduce((sum, task) => sum + (task.cost || 0), 0);
  const pendingReconCost = tasks.filter(t => t.status === 'pending').reduce((sum, task) => sum + (task.cost || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalPreSaleCost = totalReconCost + totalExpenses;
  const trueCost = purchasePrice + totalPreSaleCost;
  const projectedProfit = sellingPrice - trueCost;

  return (
    <div className="space-y-6">
      {/* Cost Summary Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground">Recon Costs</p>
          <p className="text-lg font-bold text-amber-400">{formatPrice(totalReconCost)}</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-lg font-bold text-orange-400">{formatPrice(totalExpenses)}</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
          <p className="text-xs text-muted-foreground">True Cost</p>
          <p className="text-lg font-bold text-blue-400">{formatPrice(trueCost)}</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${
          projectedProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'
        }`}>
          <p className="text-xs text-muted-foreground">Profit</p>
          <p className={`text-lg font-bold ${projectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPrice(projectedProfit)}
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'recon' | 'expenses')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recon" className="gap-2">
            <Wrench className="w-4 h-4" /> Recon Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <Receipt className="w-4 h-4" /> Expenses ({expenses.length})
          </TabsTrigger>
        </TabsList>

        {/* RECON TASKS */}
        <TabsContent value="recon" className="space-y-4 mt-4">
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
                const config = TASK_CATEGORY_CONFIG[task.category as keyof typeof TASK_CATEGORY_CONFIG] || TASK_CATEGORY_CONFIG.mechanical;
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

          {pendingReconCost > 0 && (
            <div className="flex justify-between items-center p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <span className="text-sm">Pending Recon</span>
              <span className="font-medium text-amber-400">{formatPrice(pendingReconCost)}</span>
            </div>
          )}
        </TabsContent>

        {/* EXPENSES */}
        <TabsContent value="expenses" className="space-y-4 mt-4">
          {/* Add Expense Button */}
          <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2" variant="outline">
                <Plus className="w-4 h-4" />
                Add Pre-Sale Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    placeholder="e.g., Fuel from Cape Town"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (R)</Label>
                    <Input 
                      type="number"
                      placeholder="0"
                      value={newExpense.amount || ''}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 
                      value={newExpense.category} 
                      onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date"
                    value={newExpense.date_incurred}
                    onChange={(e) => setNewExpense({ ...newExpense, date_incurred: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receipt Photo (Optional)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      disabled={isUploadingReceipt}
                      className="flex-1"
                    />
                    {newExpense.receipt_url && (
                      <div className="w-12 h-10 rounded overflow-hidden border">
                        <img src={newExpense.receipt_url} alt="Receipt" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  {isUploadingReceipt && <p className="text-xs text-muted-foreground">Uploading...</p>}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAddExpense} disabled={!newExpense.description || newExpense.amount <= 0}>
                  Add Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Expenses List */}
          <div className="space-y-2">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No expenses recorded yet</p>
                <p className="text-sm">Track fuel, tolls, and other pre-sale costs</p>
              </div>
            ) : (
              expenses.map((expense) => {
                const ExpenseIcon = EXPENSE_CATEGORY_ICONS[expense.category] || Receipt;
                const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || 'General';
                
                return (
                  <div 
                    key={expense.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <ExpenseIcon className="w-4 h-4 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabel} • {new Date(expense.date_incurred).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {expense.receipt_url && (
                        <a 
                          href={expense.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          title="View Receipt"
                        >
                          <Image className="w-4 h-4" />
                        </a>
                      )}
                      <span className="font-medium text-orange-400">{formatPrice(expense.amount)}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteExpense.mutate(expense.id)}
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
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Full Cost Breakdown */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Full Cost Analysis</h4>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
            <span className="text-sm">Purchase Price</span>
            <span className="font-medium">{formatPrice(purchasePrice)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
            <span className="text-sm">Recon Costs</span>
            <span className="font-medium text-amber-400">+{formatPrice(totalReconCost)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
            <span className="text-sm">Pre-Sale Expenses</span>
            <span className="font-medium text-orange-400">+{formatPrice(totalExpenses)}</span>
          </div>
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

export default VehicleOperationsTab;
