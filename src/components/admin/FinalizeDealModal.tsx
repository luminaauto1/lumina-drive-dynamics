import { useState, useEffect } from 'react';
import { Plus, X, MapPin, Car, DollarSign, User, Receipt, Calculator, TrendingUp } from 'lucide-react';
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
  cost_price?: number;
  purchase_price?: number;
  reconditioning_cost?: number;
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
  
  // === SECTION 1: Pricing & Structure ===
  const [sellingPrice, setSellingPrice] = useState(vehiclePrice);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [externalAdminFee, setExternalAdminFee] = useState(7000);
  const [bankInitiationFee, setBankInitiationFee] = useState(1207);
  
  // === SECTION 2: Deposits ===
  const [clientDeposit, setClientDeposit] = useState(0);
  const [dealerDepositContribution, setDealerDepositContribution] = useState(0);
  
  // === SECTION 3: Internal Costs ===
  const [costPrice, setCostPrice] = useState(0);
  const [reconCost, setReconCost] = useState(0);
  
  // Shared Capital (Joint Venture)
  const [isSharedCapital, setIsSharedCapital] = useState(false);
  const [partnerSplitPercent, setPartnerSplitPercent] = useState(50);
  
  // Sales Rep
  const [selectedRepName, setSelectedRepName] = useState('');
  const [repCommission, setRepCommission] = useState(0);
  
  // Delivery
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('10:00');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  
  // Vehicle Info
  const [soldMileage, setSoldMileage] = useState(vehicleMileage);
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [nextServiceKm, setNextServiceKm] = useState<number | ''>('');
  
  // Aftersales Expenses
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

  // Auto-fill from vehicle data
  useEffect(() => {
    if (vehicle) {
      const vehicleCostPrice = vehicle.cost_price || vehicle.purchase_price || 0;
      if (vehicleCostPrice > 0 && costPrice === 0) {
        setCostPrice(vehicleCostPrice);
      }
      if (vehicle.reconditioning_cost && vehicle.reconditioning_cost > 0 && reconCost === 0) {
        setReconCost(vehicle.reconditioning_cost);
      }
    }
  }, [vehicle]);

  // === CALCULATIONS ===
  // Adjusted Selling Price (after discount)
  const adjustedSellingPrice = sellingPrice - discountAmount;
  
  // Gross Deal (what we invoice including fees)
  const grossDeal = adjustedSellingPrice + externalAdminFee + bankInitiationFee;
  
  // Total Deposits
  const totalDeposits = clientDeposit + dealerDepositContribution;
  
  // Total Finance Amount (what bank pays us)
  const totalFinanceAmount = grossDeal - totalDeposits;
  
  // Total aftersales expenses
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // PROFIT CALCULATION (Admin/Bank fees are pass-through, NOT included)
  // Total Costs = Purchase Cost + Recon + Expenses + Dealer Deposit Contribution
  const totalCosts = costPrice + reconCost + totalExpenses + dealerDepositContribution;
  
  // Gross Profit = Adjusted Selling Price - Total Costs
  const grossProfit = adjustedSellingPrice - totalCosts;
  
  // Shared Capital Logic
  const partnerPayout = isSharedCapital ? grossProfit * (partnerSplitPercent / 100) : 0;
  const luminaRetained = grossProfit - partnerPayout;
  
  // Commission (calculated from Lumina's retained profit)
  const commissionAmount = luminaRetained * (repCommission / 100);
  
  // Net Profit after commission
  const netProfit = luminaRetained - commissionAmount;

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

  const handleSubmit = async () => {
    if (!selectedRepName || !deliveryAddress || !deliveryDate) {
      return;
    }

    try {
      await createDealRecord.mutateAsync({
        applicationId,
        vehicleId,
        salesRepName: selectedRepName,
        salesRepCommission: commissionAmount,
        soldPrice: adjustedSellingPrice, // Store the adjusted (post-discount) price
        soldMileage,
        nextServiceDate: nextServiceDate || undefined,
        nextServiceKm: nextServiceKm || undefined,
        deliveryAddress,
        deliveryDate: `${deliveryDate}T${deliveryTime}:00`,
        aftersalesExpenses: expenses,
        costPrice,
        calculatedProfit: netProfit,
        isSourcingVehicle: vehicleStatus === 'sourcing',
        // Shared Capital fields
        isSharedCapital,
        partnerSplitPercent: isSharedCapital ? partnerSplitPercent : 0,
        partnerProfitAmount: partnerPayout,
        // NEW F&I fields
        discountAmount,
        dealerDepositContribution,
        externalAdminFee,
        bankInitiationFee,
        totalFinancedAmount: totalFinanceAmount,
        clientDeposit,
        grossProfit,
        reconCost,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to finalize deal:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Finalize Deal - Advanced Calculator
          </DialogTitle>
          <DialogDescription>
            Complete deal structure with F&I breakdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vehicle Summary */}
          {vehicle ? (
            <div className="bg-blue-500/10 p-4 rounded-md border border-blue-500/20">
              <h3 className="font-bold text-blue-400 text-sm uppercase mb-1">Closing Deal For:</h3>
              <p className="text-xl font-semibold text-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
              <p className="text-sm text-muted-foreground">Stock: {vehicle.stock_number || 'N/A'}</p>
            </div>
          ) : (
            <div className="bg-red-500/10 p-4 rounded-md border border-red-500/20">
              <p className="text-red-400 font-bold">⚠️ WARNING: No Vehicle Assigned</p>
              <p className="text-xs text-red-300">Please close this modal and assign a vehicle first.</p>
            </div>
          )}

          {/* === SECTION 1: Pricing & Structure === */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Receipt className="w-4 h-4" />
              Section 1: Pricing & Structure
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  value={sellingPrice || ''}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Less: Discount</Label>
                <Input
                  type="number"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plus: External Admin Fee</Label>
                <Input
                  type="number"
                  value={externalAdminFee || ''}
                  onChange={(e) => setExternalAdminFee(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Plus: Bank Initiation Fee</Label>
                <Input
                  type="number"
                  value={bankInitiationFee || ''}
                  onChange={(e) => setBankInitiationFee(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Subtotal (Gross Deal):</span>
                <span className="text-lg font-bold text-primary">{formatPrice(grossDeal)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                = {formatPrice(sellingPrice)} - {formatPrice(discountAmount)} + {formatPrice(externalAdminFee)} + {formatPrice(bankInitiationFee)}
              </p>
            </div>
          </div>

          <Separator />

          {/* === SECTION 2: Deductions / Deposits === */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <DollarSign className="w-4 h-4" />
              Section 2: Deductions / Deposits
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Less: Client Cash Deposit</Label>
                <Input
                  type="number"
                  value={clientDeposit || ''}
                  onChange={(e) => setClientDeposit(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Less: Dealer Deposit Contribution</Label>
                <Input
                  type="number"
                  value={dealerDepositContribution || ''}
                  onChange={(e) => setDealerDepositContribution(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">We pay this - reduces profit</p>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Finance Amount:</span>
                <span className="text-lg font-bold text-emerald-400">{formatPrice(totalFinanceAmount)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Invoice to Bank = Gross Deal - Deposits
              </p>
            </div>
          </div>

          <Separator />

          {/* === SECTION 3: Internal Costs === */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <TrendingUp className="w-4 h-4" />
              Section 3: Internal Costs
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Cost (Cost Price)</Label>
                <Input
                  type="number"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  placeholder="What we paid for the car"
                />
              </div>
              <div className="space-y-2">
                <Label>Recon / Expenses</Label>
                <Input
                  type="number"
                  value={reconCost || ''}
                  onChange={(e) => setReconCost(parseFloat(e.target.value) || 0)}
                  placeholder="Total reconditioning"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Sales Rep Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <User className="w-4 h-4" />
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
          </div>

          {/* Shared Capital / Joint Venture Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <input
                type="checkbox"
                id="sharedCapital"
                checked={isSharedCapital}
                onChange={(e) => setIsSharedCapital(e.target.checked)}
                className="w-4 h-4 rounded border-orange-500 text-orange-500 focus:ring-orange-500"
              />
              <Label htmlFor="sharedCapital" className="text-sm font-medium cursor-pointer">
                Joint Venture / Shared Capital?
              </Label>
            </div>
            
            {isSharedCapital && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-orange-500/5 rounded-lg">
                <div className="space-y-2">
                  <Label>Partner Share (%)</Label>
                  <Input
                    type="number"
                    value={partnerSplitPercent}
                    onChange={(e) => setPartnerSplitPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Partner Payout</Label>
                  <div className="p-2 rounded-lg border bg-orange-500/10 border-orange-500/30">
                    <span className="text-lg font-bold text-orange-400">{formatPrice(partnerPayout)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Delivery Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <MapPin className="w-4 h-4" />
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
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Car className="w-4 h-4" />
              Vehicle Information
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Mileage (km)</Label>
                <Input
                  type="number"
                  value={soldMileage}
                  onChange={(e) => setSoldMileage(parseInt(e.target.value) || 0)}
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
            <div className="space-y-2">
              <Label>Next Service Date (Optional)</Label>
              <Input
                type="date"
                value={nextServiceDate}
                onChange={(e) => setNextServiceDate(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Aftersales Expenses Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <DollarSign className="w-4 h-4" />
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

          <Separator />

          {/* === DEAL BREAKDOWN SUMMARY CARD === */}
          <div className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border-2 border-primary/30">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Deal Breakdown
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Invoice to Bank:</span>
                <span className="text-lg font-bold text-emerald-400">{formatPrice(totalFinanceAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Total Costs:</span>
                <span className="font-medium text-red-400">-{formatPrice(totalCosts)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Lumina Gross Profit:</span>
                <span className={`text-lg font-bold ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPrice(grossProfit)}
                </span>
              </div>
              
              {isSharedCapital && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Partner Payout ({partnerSplitPercent}%):</span>
                  <span className="font-medium text-orange-400">-{formatPrice(partnerPayout)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Commission ({repCommission}%):</span>
                <span className="font-medium text-blue-400">-{formatPrice(commissionAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center py-3 bg-primary/10 rounded-lg px-3 -mx-1">
                <span className="text-sm font-semibold">Net Profit:</span>
                <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPrice(netProfit)}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Note: Admin & Bank fees are pass-through and not included in profit calculation.
            </p>
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
