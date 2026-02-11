import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, X, MapPin, Car, DollarSign, User, Receipt, Calculator, TrendingUp, Search, ChevronDown, Package, UserPlus, Eye, FileText, CalendarIcon } from 'lucide-react';
import { PartnerPayoutModal } from './PartnerPayoutModal';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useCreateDealRecord, useUpdateDealRecord, AftersalesExpense, DealAddOnItem } from '@/hooks/useDealRecords';
import { formatPrice, useVehicles, Vehicle } from '@/hooks/useVehicles';
import { useVehicleExpenses, VehicleExpense, EXPENSE_CATEGORIES } from '@/hooks/useVehicleExpenses';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

// Existing deal data for edit mode
export interface ExistingDealData {
  id: string;
  application_id?: string | null;
  vehicle_id?: string | null;
  sold_price?: number | null;
  sold_mileage?: number | null;
  cost_price?: number | null;
  recon_cost?: number | null;
  gross_profit?: number | null;
  dic_amount?: number | null;
  discount_amount?: number | null;
  dealer_deposit_contribution?: number | null;
  external_admin_fee?: number | null;
  bank_initiation_fee?: number | null;
  client_deposit?: number | null;
  total_financed_amount?: number | null;
  is_shared_capital?: boolean | null;
  partner_split_type?: string | null;
  partner_split_value?: number | null;
  partner_split_percent?: number | null;
  partner_profit_amount?: number | null;
  partner_capital_contribution?: number | null;
  sales_rep_name?: string | null;
  sales_rep_commission?: number | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  next_service_date?: string | null;
  next_service_km?: number | null;
  aftersales_expenses?: Array<{ type: string; amount: number; description?: string }> | null;
  addons_data?: DealAddOnItem[] | null;
  // Referral fields (Expense)
  referral_commission_amount?: number | null;
  referral_person_name?: string | null;
  // Referral Income (what we receive)
  referral_income_amount?: number | null;
  // Sale date for reporting
  sale_date?: string | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    cost_price?: number;
    purchase_price?: number;
    reconditioning_cost?: number;
  };
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
  onVehicleChange?: (vehicleId: string) => void;
  // Edit mode prop
  existingDeal?: ExistingDealData | null;
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
  onVehicleChange,
  existingDeal,
}: FinalizeDealModalProps) => {
  const { data: settings } = useSiteSettings();
  const createDealRecord = useCreateDealRecord();
  const updateDealRecord = useUpdateDealRecord();
  
  const isEditMode = !!existingDeal;
  const [showReport, setShowReport] = useState(false);
  
  // Fetch ALL vehicles including hidden for selection
  const { data: allVehicles = [] } = useVehicles();
  
  // Vehicle selector state
  const [activeVehicleId, setActiveVehicleId] = useState(vehicleId);
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  
  // Get the active vehicle from the full list or use prop vehicle
  const activeVehicle = useMemo(() => {
    if (activeVehicleId && allVehicles.length > 0) {
      const found = allVehicles.find(v => v.id === activeVehicleId);
      if (found) return found;
    }
    // Fall back to prop vehicle
    if (vehicle) {
      return {
        id: vehicleId,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        stock_number: vehicle.stock_number,
        cost_price: vehicle.cost_price,
        purchase_price: vehicle.purchase_price,
        reconditioning_cost: vehicle.reconditioning_cost,
        price: vehiclePrice,
        mileage: vehicleMileage,
        status: vehicleStatus,
      } as Vehicle;
    }
    return null;
  }, [activeVehicleId, allVehicles, vehicle, vehicleId, vehiclePrice, vehicleMileage, vehicleStatus]);
  
  // Filter vehicles for selector - include all admin-accessible statuses
  const selectableVehicles = useMemo(() => {
    return allVehicles.filter(v => 
      ['available', 'reserved', 'incoming', 'sourcing', 'hidden'].includes(v.status)
    );
  }, [allVehicles]);
  
  // Filter by search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearchQuery) return selectableVehicles;
    const query = vehicleSearchQuery.toLowerCase();
    return selectableVehicles.filter(v => 
      `${v.make} ${v.model} ${v.variant || ''} ${v.stock_number || ''}`.toLowerCase().includes(query)
    );
  }, [selectableVehicles, vehicleSearchQuery]);
  
  // Track if form has been initialized from existing deal (prevent overwrites)
  // Using useRef to prevent re-initialization on re-renders
  const isInitialized = useRef(false);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  
  // === SECTION 1: Pricing & Structure ===
  const [sellingPrice, setSellingPrice] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [externalAdminFee, setExternalAdminFee] = useState(7000);
  const [bankInitiationFee, setBankInitiationFee] = useState(1207);
  
  // === SECTION 2: Deposits ===
  const [clientDeposit, setClientDeposit] = useState(0);
  const [dealerDepositContribution, setDealerDepositContribution] = useState(0);
  
  // === SECTION 3: Internal Costs ===
  const [costPrice, setCostPrice] = useState(0);
  
  // Vehicle Ledger Costs (from vehicle_expenses table - read-only)
  const [vehicleLedgerCosts, setVehicleLedgerCosts] = useState(0);
  const [vehicleLedgerBreakdown, setVehicleLedgerBreakdown] = useState<VehicleExpense[]>([]);
  const [showLedgerBreakdown, setShowLedgerBreakdown] = useState(false);
  
  // Additional Deal Expenses (editable, for deal-specific costs)
  const [additionalDealCosts, setAdditionalDealCosts] = useState(0);
  
  // DIC (Dealer Incentive Commission - Bank Reward)
  const [dicAmount, setDicAmount] = useState(0);
  
  // Shared Capital (Joint Venture)
  const [isSharedCapital, setIsSharedCapital] = useState(false);
  const [partnerSplitType, setPartnerSplitType] = useState<'percentage' | 'fixed'>('percentage');
  const [partnerSplitValue, setPartnerSplitValue] = useState(50);
  const [partnerCapitalContribution, setPartnerCapitalContribution] = useState(0);
  
  // Value Added Products (VAPS) - with stable IDs to prevent keyboard dismissal on Android
  const [addons, setAddons] = useState<(DealAddOnItem & { _id: string })[]>([]);
  const addonIdCounter = useRef(0);

  // Sales Rep
  const [selectedRepName, setSelectedRepName] = useState('');
  const [repCommission, setRepCommission] = useState(0);
  
  // Referral Expense (what we PAY OUT)
  const [referralName, setReferralName] = useState('');
  const [referralCommission, setReferralCommission] = useState(0);
  
  // Referral Income (what we RECEIVE)
  const [referralIncome, setReferralIncome] = useState(0);
  
  // Sale Date for reporting
  const [saleDate, setSaleDate] = useState<Date>(new Date());
  
  // Delivery
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('10:00');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  
  // Vehicle Info
  const [soldMileage, setSoldMileage] = useState(0);
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [nextServiceKm, setNextServiceKm] = useState<number | ''>('');
  
  // Aftersales Expenses
  const [expenses, setExpenses] = useState<AftersalesExpense[]>([]);
  
  // Get sales reps from settings
  const salesReps: SalesRep[] = (settings as any)?.sales_reps || [];
  
  // Reset form initialization when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsFormInitialized(false);
      isInitialized.current = false;
    }
  }, [isOpen]);

  // Initialize from existing deal data (EDIT MODE) - PRIORITY over vehicle defaults
  // CRITICAL FIX: Using ref to ensure we only initialize ONCE and never reset from vehicle price
  useEffect(() => {
    if (isOpen && !isFormInitialized && !isInitialized.current) {
      if (existingDeal) {
        // EDIT MODE: Load all saved deal values - NEVER use vehicle defaults
        console.log('[FinalizeDealModal] EDIT MODE: Loading saved deal data, ignoring vehicle price');
        isInitialized.current = true; // Lock initialization immediately
        // EDIT MODE: Load all saved deal values - NEVER use vehicle defaults
        // Vehicle
        if (existingDeal.vehicle_id) {
          setActiveVehicleId(existingDeal.vehicle_id);
        }
        
        // CRITICAL: Use saved sold_price, NOT vehiclePrice
        setSellingPrice(Number(existingDeal.sold_price) || 0);
        setDiscountAmount(Number(existingDeal.discount_amount) || 0);
        setExternalAdminFee(existingDeal.external_admin_fee ?? 7000);
        setBankInitiationFee(existingDeal.bank_initiation_fee ?? 1207);
        
        // Deposits
        setClientDeposit(Number(existingDeal.client_deposit) || 0);
        setDealerDepositContribution(Number(existingDeal.dealer_deposit_contribution) || 0);
        
        // Costs - CRITICAL: Use saved cost_price
        setCostPrice(Number(existingDeal.cost_price) || 0);
        // recon_cost in existing deal represents total (ledger + additional)
        // We'll split this once we fetch ledger costs
        setAdditionalDealCosts(Number(existingDeal.recon_cost) || 0);
        setDicAmount(Number(existingDeal.dic_amount) || 0);
        
        // Partner Split
        setIsSharedCapital(existingDeal.is_shared_capital || false);
        setPartnerSplitType((existingDeal.partner_split_type as 'percentage' | 'fixed') || 'percentage');
        setPartnerSplitValue(Number(existingDeal.partner_split_value) || Number(existingDeal.partner_split_percent) || 50);
        setPartnerCapitalContribution(Number(existingDeal.partner_capital_contribution) || 0);
        
        // Add-ons - add stable IDs for existing data
        if (existingDeal.addons_data && Array.isArray(existingDeal.addons_data)) {
          setAddons(existingDeal.addons_data.map((addon, idx) => ({
            ...addon,
            _id: `existing-${idx}-${Date.now()}`
          })));
        } else {
          setAddons([]);
        }
        
        // Sales Rep
        setSelectedRepName(existingDeal.sales_rep_name || '');
        
        // Referrals (Expense)
        setReferralName(existingDeal.referral_person_name || '');
        setReferralCommission(Number(existingDeal.referral_commission_amount) || 0);
        
        // Referral Income
        setReferralIncome(Number(existingDeal.referral_income_amount) || 0);
        
        // Delivery
        if (existingDeal.delivery_date) {
          const deliveryDateTime = new Date(existingDeal.delivery_date);
          setDeliveryDate(deliveryDateTime.toISOString().split('T')[0]);
          setDeliveryTime(deliveryDateTime.toTimeString().slice(0, 5));
        }
        setDeliveryAddress(existingDeal.delivery_address || '');
        
        // Vehicle Info
        setSoldMileage(Number(existingDeal.sold_mileage) || 0);
        setNextServiceDate(existingDeal.next_service_date || '');
        setNextServiceKm(existingDeal.next_service_km || '');
        
        // Sale Date
        if (existingDeal.sale_date) {
          setSaleDate(new Date(existingDeal.sale_date));
        } else {
          setSaleDate(new Date());
        }
        
        // Expenses
        if (existingDeal.aftersales_expenses && Array.isArray(existingDeal.aftersales_expenses)) {
          setExpenses(existingDeal.aftersales_expenses);
        } else {
          setExpenses([]);
        }
        
        // Mark as initialized to prevent overwrites
        setIsFormInitialized(true);
      } else {
        // NEW DEAL: Initialize from vehicle props (ONLY ONCE)
        console.log('[FinalizeDealModal] NEW DEAL: Initializing from vehicle price');
        isInitialized.current = true; // Lock initialization immediately
        
        setActiveVehicleId(vehicleId);
        setSellingPrice(vehiclePrice);
        setSoldMileage(vehicleMileage);
        
        // Set cost price from vehicle
        const vehicleCostPrice = vehicle?.cost_price || vehicle?.purchase_price || 0;
        if (vehicleCostPrice > 0) {
          setCostPrice(vehicleCostPrice);
        }
        
        // Reset other fields to defaults
        setDiscountAmount(0);
        setExternalAdminFee(7000);
        setBankInitiationFee(1207);
        setClientDeposit(0);
        setDealerDepositContribution(0);
        setAdditionalDealCosts(0);
        setDicAmount(0);
        setIsSharedCapital(false);
        setPartnerSplitType('percentage');
        setPartnerSplitValue(50);
        setPartnerCapitalContribution(0);
        setAddons([]);
        setSelectedRepName('');
        setReferralName('');
        setReferralCommission(0);
        setReferralIncome(0);
        setDeliveryDate('');
        setDeliveryTime('10:00');
        setDeliveryAddress('');
        setNextServiceDate('');
        setNextServiceKm('');
        setExpenses([]);
        setSaleDate(new Date()); // Default to today for new deals
        
        setIsFormInitialized(true);
      }
    }
    // CRITICAL: Do NOT include vehiclePrice, vehicleMileage, vehicle, vehicleId
    // to prevent re-renders from resetting user input when editing
  }, [isOpen, existingDeal]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Update active vehicle ID when prop changes (for new deals only, when not yet initialized)
  useEffect(() => {
    if (!existingDeal && !isFormInitialized && vehicleId && vehicleId !== activeVehicleId) {
      setActiveVehicleId(vehicleId);
    }
  }, [vehicleId, existingDeal, isFormInitialized, activeVehicleId]);
  
  // Handle vehicle selection change (user explicitly changes vehicle)
  const handleVehicleSelect = (newVehicleId: string) => {
    setActiveVehicleId(newVehicleId);
    setVehicleSearchOpen(false);
    setVehicleSearchQuery('');
    
    // Update selling price and mileage from the new vehicle
    const newVehicle = allVehicles.find(v => v.id === newVehicleId);
    if (newVehicle) {
      setSellingPrice(newVehicle.price);
      setSoldMileage(newVehicle.mileage);
      setCostPrice(newVehicle.cost_price || newVehicle.purchase_price || 0);
      // Reset additional costs when vehicle changes - ledger costs will be fetched automatically
      setAdditionalDealCosts(0);
    }
    
    // Notify parent if callback provided
    onVehicleChange?.(newVehicleId);
  };
  
  // Update commission when rep changes
  useEffect(() => {
    const rep = salesReps.find(r => r.name === selectedRepName);
    if (rep) {
      setRepCommission(rep.commission);
    }
  }, [selectedRepName, salesReps]);
  
  // Fetch vehicle expenses when activeVehicle changes
  useEffect(() => {
    const fetchVehicleExpenses = async () => {
      if (!activeVehicleId || !isOpen) {
        setVehicleLedgerCosts(0);
        setVehicleLedgerBreakdown([]);
        return;
      }
      
      try {
        const { data, error } = await (supabase as any)
          .from('vehicle_expenses')
          .select('*')
          .eq('vehicle_id', activeVehicleId)
          .order('date_incurred', { ascending: false });
        
        if (error) {
          console.warn('Could not fetch vehicle expenses:', error.message);
          setVehicleLedgerCosts(0);
          setVehicleLedgerBreakdown([]);
          return;
        }
        
        const expenses = (data || []) as VehicleExpense[];
        const total = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        setVehicleLedgerBreakdown(expenses);
        setVehicleLedgerCosts(total);
        
        // In edit mode, subtract ledger costs from stored recon_cost to get additional costs
        if (existingDeal && existingDeal.recon_cost) {
          const additionalFromDeal = Math.max(0, (existingDeal.recon_cost || 0) - total);
          setAdditionalDealCosts(additionalFromDeal);
        }
      } catch (err) {
        console.warn('Error fetching vehicle expenses:', err);
        setVehicleLedgerCosts(0);
        setVehicleLedgerBreakdown([]);
      }
    };
    
    fetchVehicleExpenses();
  }, [activeVehicleId, isOpen, existingDeal]);

  // Total recon cost (ledger + additional)
  const totalReconCost = vehicleLedgerCosts + additionalDealCosts;

  // === CALCULATIONS ===
  // Add-ons totals
  const totalAddonCost = addons.reduce((sum, addon) => sum + (addon.cost || 0), 0);
  const totalAddonPrice = addons.reduce((sum, addon) => sum + (addon.price || 0), 0);
  const addonProfit = totalAddonPrice - totalAddonCost;
  
  // Adjusted Selling Price (after discount)
  const adjustedSellingPrice = sellingPrice - discountAmount;
  
  // Gross Deal (what we invoice including fees and addons)
  const grossDeal = adjustedSellingPrice + totalAddonPrice + externalAdminFee + bankInitiationFee;
  
  // Total Deposits
  const totalDeposits = clientDeposit + dealerDepositContribution;
  
  // Total Finance Amount (what bank pays us)
  const totalFinanceAmount = grossDeal - totalDeposits;
  
  // Total aftersales expenses
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // === UPDATED PROFIT CALCULATION ===
  // Gross Income = (Selling Price - Discount) + VAP Revenue + DIC + Referral Income
  const grossIncome = adjustedSellingPrice + totalAddonPrice + dicAmount + referralIncome;
  
  // Total Costs = Vehicle Cost + Recon (Ledger + Additional) + Expenses + Dealer Deposit Contribution + Addon Costs + Referral Expense
  const totalCosts = costPrice + totalReconCost + totalExpenses + dealerDepositContribution + totalAddonCost + referralCommission;
  
  // Gross Profit = Gross Income - Total Costs
  const grossProfit = grossIncome - totalCosts;
  
  // Shared Capital Logic - supports both percentage and fixed
  const partnerPayout = useMemo(() => {
    if (!isSharedCapital) return 0;
    if (partnerSplitType === 'percentage') {
      return grossProfit * (partnerSplitValue / 100);
    }
    // Fixed amount
    return partnerSplitValue;
  }, [isSharedCapital, partnerSplitType, partnerSplitValue, grossProfit]);
  
  // Lumina Net Profit = Gross Profit - Partner Share (THIS is what gets saved to DB)
  const luminaNetProfit = grossProfit - partnerPayout;
  
  // Commission (calculated from Lumina's net profit, shown as separate payout)
  const commissionAmount = luminaNetProfit * (repCommission / 100);
  
  // Final Net Profit After All Payouts (for display only - not saved to DB)
  const finalNetAfterPayouts = luminaNetProfit - commissionAmount;
  
  // Add-on helpers - use stable _id to prevent Android keyboard issues
  const addAddon = () => {
    addonIdCounter.current += 1;
    setAddons(prev => [...prev, { name: '', cost: 0, price: 0, _id: `addon-${addonIdCounter.current}-${Date.now()}` }]);
  };

  const removeAddon = (id: string) => {
    setAddons(prev => prev.filter(addon => addon._id !== id));
  };

  const updateAddon = (id: string, field: keyof DealAddOnItem, value: string | number) => {
    setAddons(prev => prev.map(addon => 
      addon._id === id ? { ...addon, [field]: value } : addon
    ));
  };

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
    if (!selectedRepName || !deliveryAddress || !deliveryDate || !activeVehicleId) {
      return;
    }

    const dealData = {
      applicationId: isEditMode ? (existingDeal?.application_id || applicationId) : applicationId,
      vehicleId: activeVehicleId,
      salesRepName: selectedRepName,
      salesRepCommission: commissionAmount,
      soldPrice: adjustedSellingPrice + totalAddonPrice,
      soldMileage,
      nextServiceDate: nextServiceDate || undefined,
      nextServiceKm: nextServiceKm || undefined,
      deliveryAddress,
      deliveryDate: `${deliveryDate}T${deliveryTime}:00`,
      aftersalesExpenses: expenses,
      costPrice,
      // Sale date for reporting
      saleDate: format(saleDate, 'yyyy-MM-dd'),
      // Save Lumina Net Profit BEFORE commission is subtracted
      calculatedProfit: luminaNetProfit,
      isSourcingVehicle: activeVehicle?.status === 'sourcing',
      // Shared Capital fields
      isSharedCapital,
      partnerSplitPercent: isSharedCapital && partnerSplitType === 'percentage' ? partnerSplitValue : 0,
      partnerProfitAmount: partnerPayout,
      partnerSplitType,
      partnerSplitValue: isSharedCapital ? partnerSplitValue : 0,
      partnerCapitalContribution: isSharedCapital ? partnerCapitalContribution : 0,
      // F&I fields
      discountAmount,
      dealerDepositContribution,
      externalAdminFee,
      bankInitiationFee,
      totalFinancedAmount: totalFinanceAmount,
      clientDeposit,
      // CRITICAL: Save Lumina Net Profit (AFTER partner split deduction)
      // This is: Gross Profit - Partner Payout
      // Commission is NOT subtracted - it's tracked separately
      grossProfit: luminaNetProfit,
      reconCost: totalReconCost, // Sum of ledger costs + additional deal costs
      // DIC (Bank Reward)
      dicAmount,
      // Add-ons (strip internal _id before saving)
      addonsData: addons.map(({ _id, ...addon }) => addon),
      // Referral Expense (what we pay out)
      referralPersonName: referralName || undefined,
      referralCommissionAmount: referralCommission,
      // Referral Income (what we receive)
      referralIncomeAmount: referralIncome,
    };

    try {
      if (isEditMode && existingDeal) {
        // UPDATE existing deal
        await updateDealRecord.mutateAsync({
          dealId: existingDeal.id,
          ...dealData,
        });
      } else {
        // INSERT new deal
        await createDealRecord.mutateAsync(dealData);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save deal:', error);
    }
  };

  const isPending = createDealRecord.isPending || updateDealRecord.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            {isEditMode ? 'Edit Deal Structure' : 'Finalize Deal - Advanced Calculator'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update deal structure and recalculate profit.' : 'Complete deal structure with F&I breakdown.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sale Date Picker */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <CalendarIcon className="w-4 h-4" />
              Sale Date (for Reporting)
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !saleDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {saleDate ? format(saleDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={saleDate}
                  onSelect={(date) => date && setSaleDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Date the sale was finalized. Used for monthly reporting and analytics.
            </p>
          </div>

          {/* Vehicle Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
              <Car className="w-4 h-4" />
              Deal Vehicle
            </div>
            <Popover open={vehicleSearchOpen} onOpenChange={setVehicleSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={vehicleSearchOpen}
                  className="w-full justify-between h-auto py-3"
                >
                  {activeVehicle ? (
                    <div className="text-left">
                      <p className="font-semibold">
                        {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {activeVehicle.stock_number || 'N/A'} • {formatPrice(activeVehicle.price || 0)}
                        {activeVehicle.status === 'hidden' && (
                          <span className="ml-2 text-amber-400">(Hidden)</span>
                        )}
                        {activeVehicle.status === 'sourcing' && (
                          <span className="ml-2 text-purple-400">(Sourcing)</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a vehicle...</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vehicles..."
                      value={vehicleSearchQuery}
                      onChange={(e) => setVehicleSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[300px]">
                  {filteredVehicles.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No vehicles found</p>
                  ) : (
                    <div className="p-1">
                      {filteredVehicles.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => handleVehicleSelect(v.id)}
                          className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors ${
                            v.id === activeVehicleId ? 'bg-primary/10 border border-primary/30' : ''
                          }`}
                        >
                          <p className="font-medium text-sm">
                            {v.year} {v.make} {v.model} {v.variant || ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(v.price)} • {v.stock_number || 'No Stock #'}
                            {v.status === 'hidden' && <span className="ml-2 text-amber-400">(Hidden)</span>}
                            {v.status === 'sourcing' && <span className="ml-2 text-purple-400">(Sourcing)</span>}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            
            {!activeVehicle && (
              <div className="bg-red-500/10 p-3 rounded-md border border-red-500/20">
                <p className="text-red-400 text-sm font-medium">⚠️ Please select a vehicle to finalize the deal</p>
              </div>
            )}
          </div>

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
              {/* Vehicle Ledger Costs (Read-Only) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  Vehicle Ledger Total
                </Label>
                <Collapsible open={showLedgerBreakdown} onOpenChange={setShowLedgerBreakdown}>
                  <div className="relative">
                    <Input
                      type="number"
                      value={vehicleLedgerCosts || ''}
                      disabled
                      className="bg-muted/50 cursor-not-allowed pr-10"
                      placeholder="Auto-fetched from expenses"
                    />
                    {vehicleLedgerBreakdown.length > 0 && (
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                  <CollapsibleContent className="mt-2">
                    <div className="p-3 bg-muted/30 rounded-lg border text-sm space-y-2 max-h-40 overflow-y-auto">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Expense Breakdown:</p>
                      {vehicleLedgerBreakdown.map((exp, idx) => {
                        const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category;
                        return (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">
                              {categoryLabel}: {exp.description}
                            </span>
                            <span className="font-medium">{formatPrice(exp.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <p className="text-xs text-muted-foreground">
                  {vehicleLedgerBreakdown.length > 0 
                    ? `${vehicleLedgerBreakdown.length} expense(s) from vehicle ledger`
                    : 'No ledger expenses found'
                  }
                </p>
              </div>
              
              {/* Additional Deal Costs (Editable) */}
              <div className="space-y-2">
                <Label>Additional Deal Expenses</Label>
                <Input
                  type="number"
                  value={additionalDealCosts || ''}
                  onChange={(e) => setAdditionalDealCosts(parseFloat(e.target.value) || 0)}
                  placeholder="Deal-specific costs"
                />
                <p className="text-xs text-muted-foreground">
                  Costs specific to this deal (e.g., urgent roadworthy)
                </p>
              </div>
            </div>
            
            {/* Total Recon Display */}
            <div className="p-3 bg-muted/30 rounded-lg border flex justify-between items-center">
              <span className="text-sm font-medium">Total Recon/Expenses:</span>
              <span className="text-lg font-bold text-primary">{formatPrice(totalReconCost)}</span>
            </div>
            
            {/* DIC / Bank Reward Section */}
            <div className="p-4 mt-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Bank Reward / DIC</span>
              </div>
              <div className="space-y-2">
                <Label>DIC Amount (Pure Profit)</Label>
                <Input
                  type="number"
                  value={dicAmount || ''}
                  onChange={(e) => setDicAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Bank incentive commission"
                />
                <p className="text-xs text-muted-foreground">
                  Dealer Incentive Commission from bank. This is pure profit and does NOT appear on client invoice.
                </p>
              </div>
            </div>
            
            {/* Referral Income Section (Money we RECEIVE) */}
            <div className="p-4 mt-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Referral Income (Received)</span>
              </div>
              <div className="space-y-2">
                <Label>Referral Income Amount</Label>
                <Input
                  type="number"
                  value={referralIncome || ''}
                  onChange={(e) => setReferralIncome(parseFloat(e.target.value) || 0)}
                  placeholder="Money received from referral"
                />
                <p className="text-xs text-muted-foreground">
                  Income we receive for referring clients. Pure profit - adds to Gross Profit.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* === VALUE ADDED PRODUCTS (VAPS) SECTION === */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-400">
                <Package className="w-4 h-4" />
                Value Added Products (VAPs)
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAddon}>
                <Plus className="w-4 h-4 mr-1" />
                Add Product
              </Button>
            </div>
            
            {addons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                No add-ons. Add products like Android Auto, Tinting, Mats, etc.
              </p>
            ) : (
              <div className="space-y-3">
                {addons.map((addon) => (
                  <div key={addon._id} className="flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                    <Input
                      placeholder="Product name (e.g., Android Auto)"
                      value={addon.name}
                      onChange={(e) => updateAddon(addon._id, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Cost:</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={addon.cost || ''}
                        onChange={(e) => updateAddon(addon._id, 'cost', parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Sell:</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={addon.price || ''}
                        onChange={(e) => updateAddon(addon._id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAddon(addon._id)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                {/* Add-ons summary */}
                <div className="flex justify-between items-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Add-on Totals</p>
                    <p className="text-xs text-muted-foreground">
                      Cost: {formatPrice(totalAddonCost)} | Revenue: {formatPrice(totalAddonPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-purple-400">
                      +{formatPrice(addonProfit)} profit
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />
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

          {/* === REFERRAL COMMISSION SECTION === */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <UserPlus className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-cyan-400">Referral Commission (Optional)</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Referral Person Name</Label>
                <Input
                  placeholder="Who referred this deal?"
                  value={referralName}
                  onChange={(e) => setReferralName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Referral Commission (R)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={referralCommission || ''}
                  onChange={(e) => setReferralCommission(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Deducted from net profit</p>
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
              <div className="space-y-4 p-3 bg-orange-500/5 rounded-lg">
                {/* Split Type Toggle */}
                <div className="space-y-2">
                  <Label>Split Type</Label>
                  <ToggleGroup
                    type="single"
                    value={partnerSplitType}
                    onValueChange={(v) => v && setPartnerSplitType(v as 'percentage' | 'fixed')}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="percentage" className="px-4">
                      % Percentage
                    </ToggleGroupItem>
                    <ToggleGroupItem value="fixed" className="px-4">
                      R Fixed Amount
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {partnerSplitType === 'percentage' ? 'Partner Share (%)' : 'Partner Amount (R)'}
                    </Label>
                    <Input
                      type="number"
                      value={partnerSplitValue}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (partnerSplitType === 'percentage') {
                          setPartnerSplitValue(Math.min(100, Math.max(0, val)));
                        } else {
                          setPartnerSplitValue(Math.max(0, val));
                        }
                      }}
                      min={0}
                      max={partnerSplitType === 'percentage' ? 100 : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner Capital Contribution</Label>
                    <Input
                      type="number"
                      value={partnerCapitalContribution || ''}
                      onChange={(e) => setPartnerCapitalContribution(parseFloat(e.target.value) || 0)}
                      placeholder="Capital invested"
                    />
                    <p className="text-xs text-muted-foreground">
                      Refunded on payout (Capital + Profit Share).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Partner Payout (Profit)</Label>
                    <div className="p-2 rounded-lg border bg-orange-500/10 border-orange-500/30">
                      <span className="text-lg font-bold text-orange-400">{formatPrice(partnerPayout)}</span>
                    </div>
                  </div>
                  {partnerCapitalContribution > 0 && (
                    <div className="space-y-2">
                      <Label>Total Partner Payout</Label>
                      <div className="p-2 rounded-lg border bg-orange-500/10 border-orange-500/30">
                        <span className="text-lg font-bold text-orange-400">{formatPrice(partnerPayout + partnerCapitalContribution)}</span>
                        <p className="text-xs text-muted-foreground mt-1">Capital + Profit</p>
                      </div>
                    </div>
                  )}
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
              {/* Total Deal Value */}
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Vehicle Sell Price:</span>
                <span className="font-medium">{formatPrice(adjustedSellingPrice)}</span>
              </div>
              
              {addons.length > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">+ Add-on Revenue:</span>
                  <span className="font-medium text-purple-400">+{formatPrice(totalAddonPrice)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">+ Fees (Admin + Bank):</span>
                <span className="font-medium">+{formatPrice(externalAdminFee + bankInitiationFee)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border/50 bg-muted/30 -mx-2 px-2 rounded">
                <span className="text-sm font-medium">Invoice to Bank:</span>
                <span className="text-lg font-bold text-emerald-400">{formatPrice(totalFinanceAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Total Costs:</span>
                <span className="font-medium text-red-400">-{formatPrice(totalCosts)}</span>
              </div>
              <p className="text-xs text-muted-foreground -mt-2 mb-2">
                (Vehicle: {formatPrice(costPrice)} + Recon: {formatPrice(totalReconCost)} + Expenses: {formatPrice(totalExpenses)} + Dealer Deposit: {formatPrice(dealerDepositContribution)}{totalAddonCost > 0 ? ` + Addon Costs: ${formatPrice(totalAddonCost)}` : ''}{referralCommission > 0 ? ` + Referral Expense: ${formatPrice(referralCommission)}` : ''})
              </p>
              
              {dicAmount > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/50 bg-emerald-500/5">
                  <span className="text-sm text-muted-foreground">+ Bank Reward / DIC:</span>
                  <span className="font-medium text-emerald-400">+{formatPrice(dicAmount)}</span>
                </div>
              )}
              
              {referralIncome > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/50 bg-emerald-500/5">
                  <span className="text-sm text-muted-foreground">+ Referral Income:</span>
                  <span className="font-medium text-emerald-400">+{formatPrice(referralIncome)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Gross Profit:</span>
                <span className={`text-lg font-bold ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPrice(grossProfit)}
                </span>
              </div>
              
              {isSharedCapital && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">
                    Partner Payout ({partnerSplitType === 'percentage' ? `${partnerSplitValue}%` : 'Fixed'}):
                  </span>
                  <span className="font-medium text-orange-400">-{formatPrice(partnerPayout)}</span>
                </div>
              )}
              
              {/* LUMINA NET PROFIT - This is what gets saved to DB */}
              <div className="flex justify-between items-center py-3 bg-primary/10 rounded-lg px-3 -mx-1">
                <span className="text-sm font-semibold">Lumina Net Profit:</span>
                <span className={`text-xl font-bold ${luminaNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPrice(luminaNetProfit)}
                </span>
              </div>
              
              {/* Payouts Section - Shown separately, not subtracted from saved profit */}
              <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payouts from Profit:</p>
                
                <div className="flex justify-between items-center py-2 bg-blue-500/5 rounded-lg px-3 -mx-1">
                  <span className="text-sm text-muted-foreground">Sales Commission ({repCommission}%):</span>
                  <span className="font-medium text-blue-400">{formatPrice(commissionAmount)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 bg-muted/30 rounded-lg px-3 -mx-1">
                  <span className="text-sm text-muted-foreground">After Commission:</span>
                  <span className={`font-bold ${finalNetAfterPayouts >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(finalNetAfterPayouts)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Note: Admin & Bank fees are pass-through and not included in profit calculation. Commission is tracked separately.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditMode && isSharedCapital && existingDeal?.id && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReport(true)}
                className="mr-auto"
              >
                🖨️ Print Partner Report
              </Button>
              <PartnerPayoutModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                dealId={existingDeal.id}
              />
            </>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedRepName || !deliveryAddress || !deliveryDate || !activeVehicleId || isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? 'Saving...' : isEditMode ? 'Update Deal' : 'Finalize Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalizeDealModal;
