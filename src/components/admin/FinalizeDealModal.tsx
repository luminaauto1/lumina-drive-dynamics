import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, X, Calendar, MapPin, Car, DollarSign, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useCreateDealRecord, AftersalesExpense } from '@/hooks/useDealRecords';
import { formatPrice } from '@/hooks/useVehicles';

interface SalesRep {
  name: string;
  commission: number;
}

interface VehicleInfo {
  year?: number;
  make?: string;
  model?: string;
  stock_number?: string;
}

interface FinalizeDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  vehicleId: string;
  vehiclePrice: number;
  vehicleMileage: number;
  vehicleStatus?: string;
  vehicle?: VehicleInfo | null;
  onSuccess: () => void;
}

const EXPENSE_TYPES = ['Gift', 'Car Wash', 'Fuel', 'Polish', 'Service', 'Repairs', 'Other'];

const FinalizeDealModal = ({
  isOpen,
  onClose,
  applicationId,
  vehicleId,
  vehiclePrice,
  vehicleMileage,
  vehicleStatus = 'available',
  vehicle,
  onSuccess,
}: FinalizeDealModalProps) => {
  const { data: settings } = useSiteSettings();
  const createDealRecord = useCreateDealRecord();
  
  // Cost price for profit calculation
  const [costPrice, setCostPrice] = useState(0);
  
  // Sales Rep
  const [selectedRepName, setSelectedRepName] = useState('');
  const [repCommission, setRepCommission] = useState(0);
  
  // Delivery
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('10:00');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  
  // Vehicle Info
  const [soldPrice, setSoldPrice] = useState(vehiclePrice);
  const [soldMileage, setSoldMileage] = useState(vehicleMileage);
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [nextServiceKm, setNextServiceKm] = useState<number | ''>('');
  
  // Expenses
  const [expenses, setExpenses] = useState<AftersalesExpense[]>([]);
  
  // Get sales reps from settings
  const salesReps: SalesRep[] = (settings as any)?.sales_reps || [];
  
  // Update commission when rep changes
  useEffect(() => {
    const rep = salesReps.find(r => r.name === selectedRepName);
    if (rep) {
      setRepCommission(rep.commission);
    }
  }, [selectedRepName, salesReps]);

  const addExpense = () => {
    setExpenses(prev => [...prev, { type: 'Gift', amount: 0, description: '' }]);
  };

  const removeExpense = (index: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== index));
  };

  const updateExpense = (index: number, field: keyof AftersalesExpense, value: string | number) => {
    setExpenses(prev => prev.map((exp, i) => 
      i === index ? { ...exp, [field]: value } : exp
    ));
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const commissionAmount = soldPrice * (repCommission / 100);
  const calculatedProfit = soldPrice - costPrice - totalExpenses - commissionAmount;

  const handleSubmit = async () => {
    if (!selectedRepName || !deliveryAddress || !deliveryDate) {
      return;
    }

    try {
      await createDealRecord.mutateAsync({
        applicationId,
        vehicleId,
        salesRepName: selectedRepName,
        salesRepCommission: commissionAmount, // Store actual amount, not percentage
        soldPrice,
        soldMileage,
        nextServiceDate: nextServiceDate || undefined,
        nextServiceKm: nextServiceKm || undefined,
        deliveryAddress,
        deliveryDate: `${deliveryDate}T${deliveryTime}:00`,
        aftersalesExpenses: expenses,
        costPrice, // Include cost price
        calculatedProfit, // Include calculated profit
        isSourcingVehicle: vehicleStatus === 'sourcing', // Flag for evergreen logic
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to finalize deal:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Finalize Deal
          </DialogTitle>
          <DialogDescription>
            Complete the deal details before finalizing the sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vehicle Summary - Enhanced display with null check */}
          {vehicle ? (
            <div className="bg-blue-500/10 p-4 rounded-md mb-4 border border-blue-500/20">
              <h3 className="font-bold text-blue-400 text-sm uppercase mb-1">Closing Deal For:</h3>
              <p className="text-xl font-semibold text-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
              <p className="text-sm text-muted-foreground">Stock: {vehicle.stock_number || 'N/A'}</p>
            </div>
          ) : (
            <div className="bg-red-500/10 p-4 rounded-md mb-4 border border-red-500/20">
              <p className="text-red-400 font-bold">⚠️ WARNING: No Vehicle Assigned</p>
              <p className="text-xs text-red-300">Please close this modal and assign a vehicle first.</p>
            </div>
          )}
          {/* Sales Rep Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="w-4 h-4 text-primary" />
              Sales Representative
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sales Rep</Label>
                <Select value={selectedRepName} onValueChange={setSelectedRepName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rep" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReps.length === 0 ? (
                      <SelectItem value="_none" disabled>No reps configured</SelectItem>
                    ) : (
                      salesReps.map((rep) => (
                        <SelectItem key={rep.name} value={rep.name}>
                          {rep.name} ({rep.commission}%)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Commission (%)</Label>
                <Input
                  type="number"
                  value={repCommission}
                  onChange={(e) => setRepCommission(parseFloat(e.target.value) || 0)}
                  step="0.5"
                />
              </div>
            </div>
          {soldPrice > 0 && repCommission > 0 && (
              <p className="text-sm text-muted-foreground">
                Commission Amount: <span className="font-semibold text-primary">{formatPrice(commissionAmount)}</span>
              </p>
            )}
          </div>

          <Separator />

          {/* Cost Price Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="w-4 h-4 text-primary" />
              Cost & Profit
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost Price (Bought For) *</Label>
                <Input
                  type="number"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  placeholder="Enter purchase price"
                />
              </div>
              <div className="space-y-2">
                <Label>Calculated Profit</Label>
                <div className={`p-2 rounded-lg border ${calculatedProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <span className={`text-lg font-bold ${calculatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(calculatedProfit)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Profit = Sold Price - Cost - Expenses - Commission
            </p>
          </div>

          <Separator />

          {/* Delivery Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4 text-primary" />
              Delivery Details
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Date</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Time</Label>
                <Input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Delivery Address</Label>
              <Input
                placeholder="Enter delivery address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Vehicle Info Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Car className="w-4 h-4 text-primary" />
              Vehicle Information
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Final Sale Price</Label>
                <Input
                  type="number"
                  value={soldPrice}
                  onChange={(e) => setSoldPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Mileage (km)</Label>
                <Input
                  type="number"
                  value={soldMileage}
                  onChange={(e) => setSoldMileage(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Service Date (Optional)</Label>
                <Input
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Next Service (km)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 95000"
                  value={nextServiceKm}
                  onChange={(e) => setNextServiceKm(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Expenses Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="w-4 h-4 text-primary" />
                Aftersales Expenses
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addExpense}>
                <Plus className="w-4 h-4 mr-1" />
                Add Expense
              </Button>
            </div>
            
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No expenses added. Click "Add Expense" to add items like gifts, car wash, fuel, etc.
              </p>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                    <Select
                      value={expense.type}
                      onValueChange={(val) => updateExpense(index, 'type', val)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={expense.amount || ''}
                      onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-28"
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={expense.description || ''}
                      onChange={(e) => updateExpense(index, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExpense(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-end">
                  <p className="text-sm font-medium">
                    Total Expenses: <span className="text-primary">{formatPrice(totalExpenses)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedRepName || !deliveryAddress || !deliveryDate || createDealRecord.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {createDealRecord.isPending ? 'Finalizing...' : 'Finalize Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalizeDealModal;
