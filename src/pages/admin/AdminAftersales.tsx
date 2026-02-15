import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  Package, Calendar, AlertCircle, Loader2, MessageCircle, Edit2, Save, X, 
  Eye, Undo2, TrendingUp, DollarSign, Users, Plus, Receipt, Wrench, 
  FileText, ChevronDown, ChevronUp, FolderOpen, Settings, Calculator, UserPlus,
  Lock, Unlock, Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, differenceInYears, format, addYears, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientProfileModal from '@/components/admin/ClientProfileModal';
import FinalizeDealModal, { ExistingDealData } from '@/components/admin/FinalizeDealModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';
import { DealAddOnItem } from '@/hooks/useDealRecords';
import { HandoverSetupModal } from '@/components/admin/HandoverSetupModal';

interface DealRecord {
  id: string;
  application_id: string | null;
  vehicle_id: string | null;
  sales_rep_name: string | null;
  sales_rep_commission: number | null;
  sold_price: number | null;
  sold_mileage: number | null;
  next_service_date: string | null;
  next_service_km: number | null;
  delivery_address: string | null;
  delivery_date: string | null;
  aftersales_expenses: Array<{ type: string; amount: number; description?: string }> | null;
  created_at: string;
  cost_price: number | null;
  gross_profit: number | null;
  recon_cost: number | null;
  // Sale date for reporting
  sale_date: string | null;
  // DIC (Bank Reward)
  dic_amount: number | null;
  // Shared Capital fields
  is_shared_capital: boolean | null;
  partner_split_percent: number | null;
  partner_profit_amount: number | null;
  partner_split_type?: string | null;
  partner_split_value?: number | null;
  // F&I fields
  discount_amount?: number | null;
  dealer_deposit_contribution?: number | null;
  external_admin_fee?: number | null;
  bank_initiation_fee?: number | null;
  client_deposit?: number | null;
  total_financed_amount?: number | null;
  // Add-ons
  addons_data?: DealAddOnItem[] | null;
  // Referral Expense
  referral_commission_amount?: number | null;
  referral_person_name?: string | null;
  // Referral Income
  referral_income_amount?: number | null;
  // Locking
  is_closed?: boolean | null;
  post_deal_notes?: string | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    purchase_price?: number;
    reconditioning_cost?: number;
    cost_price?: number;
    last_service_date?: string;
    next_service_date?: string;
    next_service_km?: number;
  };
  application?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string;
    email: string;
    phone: string;
    gross_salary?: number | null;
    additional_income?: number | null;
  };
}

interface AftersalesRecord {
  id: string;
  vehicle_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  notes: string | null;
  finance_application_id: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: {
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
  };
}

interface ClientDocument {
  id: string;
  name: string;
  file_path: string;
  uploaded_at: string;
}

const useDealRecords = () => {
  return useQuery({
    queryKey: ['deal-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select(`
          *,
          vehicle:vehicles(id, make, model, variant, year, price, purchase_price, reconditioning_cost, cost_price, last_service_date, next_service_date, next_service_km),
          application:finance_applications(id, first_name, last_name, full_name, email, phone, gross_salary, additional_income)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(record => ({
        ...record,
        aftersales_expenses: Array.isArray(record.aftersales_expenses) 
          ? record.aftersales_expenses as unknown as Array<{ type: string; amount: number; description?: string }>
          : [],
        addons_data: Array.isArray(record.addons_data)
          ? record.addons_data as unknown as DealAddOnItem[]
          : [],
      })) as unknown as DealRecord[];
    },
  });
};

const useAftersalesRecords = () => {
  return useQuery({
    queryKey: ['aftersales-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aftersales_records')
        .select(`
          *,
          vehicle:vehicles(make, model, variant, year, price)
        `)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return data as AftersalesRecord[];
    },
  });
};

const useClientDocuments = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', clientId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data as ClientDocument[];
    },
    enabled: !!clientId,
  });
};

const useUpdateAftersalesNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('aftersales_records')
        .update({ notes })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aftersales-records'] });
      toast.success('Notes updated');
    },
    onError: () => {
      toast.error('Failed to update notes');
    },
  });
};

const useRollbackDeal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, applicationId, vehicleId }: { dealId: string; applicationId: string | null; vehicleId: string | null }) => {
      if (applicationId) {
        const { error: appError } = await supabase
          .from('finance_applications')
          .update({ status: 'approved' })
          .eq('id', applicationId);
        if (appError) throw appError;
      }

      if (vehicleId) {
        const { error: vehicleError } = await supabase
          .from('vehicles')
          .update({ status: 'available' })
          .eq('id', vehicleId);
        if (vehicleError) throw vehicleError;
      }

      const { error: dealError } = await supabase
        .from('deal_records')
        .delete()
        .eq('id', dealId);
      if (dealError) throw dealError;

      if (applicationId) {
        await supabase
          .from('aftersales_records')
          .delete()
          .eq('finance_application_id', applicationId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-records'] });
      queryClient.invalidateQueries({ queryKey: ['aftersales-records'] });
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Deal rolled back. Application returned to Approved status.');
    },
    onError: (error: any) => {
      console.error('Rollback error:', error);
      toast.error('Failed to rollback deal');
    },
  });
};

const useAddDealExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, expense, currentExpenses }: { dealId: string; expense: { type: string; amount: number }; currentExpenses: Array<{ type: string; amount: number }> }) => {
      const updatedExpenses = [...currentExpenses, expense];
      
      const { error } = await supabase
        .from('deal_records')
        .update({ aftersales_expenses: updatedExpenses as any })
        .eq('id', dealId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-records'] });
      toast.success('Expense added successfully');
    },
    onError: () => {
      toast.error('Failed to add expense');
    },
  });
};

const useLogServiceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      vehicleId, 
      dealId,
      serviceDate, 
      serviceMileage, 
      workshopName, 
      serviceCost,
      currentExpenses 
    }: { 
      vehicleId: string; 
      dealId: string;
      serviceDate: string; 
      serviceMileage: number; 
      workshopName: string; 
      serviceCost: number;
      currentExpenses: Array<{ type: string; amount: number }>;
    }) => {
      // Calculate next service date (1 year from service)
      const nextServiceDate = addYears(new Date(serviceDate), 1).toISOString().split('T')[0];
      const nextServiceKm = serviceMileage + 15000; // Standard 15,000km interval

      // Update vehicle with service info
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ 
          last_service_date: serviceDate,
          last_service_km: serviceMileage,
          next_service_date: nextServiceDate,
          next_service_km: nextServiceKm,
        })
        .eq('id', vehicleId);

      if (vehicleError) throw vehicleError;

      // Update deal record with new next service date
      const { error: dealError } = await supabase
        .from('deal_records')
        .update({ 
          next_service_date: nextServiceDate,
          next_service_km: nextServiceKm,
        })
        .eq('id', dealId);

      if (dealError) throw dealError;

      // If there's a cost, add it as an expense
      if (serviceCost > 0) {
        const updatedExpenses = [...currentExpenses, { 
          type: `Service at ${workshopName}`, 
          amount: serviceCost 
        }];
        
        await supabase
          .from('deal_records')
          .update({ aftersales_expenses: updatedExpenses as any })
          .eq('id', dealId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-records'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Service record logged. Next service date updated.');
    },
    onError: () => {
      toast.error('Failed to log service');
    },
  });
};

const getServiceDueStatus = (deal: DealRecord) => {
  if (!deal.next_service_date) return { isDue: false, reason: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const serviceDate = new Date(deal.next_service_date);
  serviceDate.setHours(0, 0, 0, 0);
  
  if (serviceDate < today) {
    return { isDue: true, reason: 'Service Date Passed' };
  }
  
  return { isDue: false, reason: null };
};

const getServiceStatus = (saleDate: string) => {
  const days = differenceInDays(new Date(), new Date(saleDate));
  const years = differenceInYears(new Date(), new Date(saleDate));
  
  const daysSinceLastService = days % 365;
  const daysUntilNextService = 365 - daysSinceLastService;
  
  const yearsRemaining = 3 - (years % 3);
  const daysUntil3Year = yearsRemaining * 365 - daysSinceLastService;
  
  let serviceStatus: 'ok' | 'due_soon' | 'overdue' = 'ok';
  let tradeInStatus: 'ok' | 'due_soon' | 'overdue' = 'ok';
  
  if (daysUntilNextService <= 0 || daysUntilNextService > 335) {
    serviceStatus = 'overdue';
  } else if (daysUntilNextService <= 30) {
    serviceStatus = 'due_soon';
  }
  
  if (years >= 3 && daysUntil3Year <= 0) {
    tradeInStatus = 'overdue';
  } else if (daysUntil3Year <= 90 && daysUntil3Year > 0) {
    tradeInStatus = 'due_soon';
  }
  
  return { serviceStatus, tradeInStatus, daysUntilNextService, daysUntil3Year, years };
};

const getVehicleHealthStatus = (saleDateString: string | null) => {
  if (!saleDateString) return { label: "No Sale Date", color: "text-zinc-500", bg: "bg-zinc-900", days: 0 };

  const saleDate = new Date(saleDateString);
  const now = new Date();

  if (isNaN(saleDate.getTime())) return { label: "Invalid Date", color: "text-red-500", bg: "bg-red-500/10", days: 0 };

  const diffTime = now.getTime() - saleDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: "Future Date?", color: "text-red-500", bg: "bg-red-500/10", days: diffDays };

  if (diffDays < 90) {
    return { label: "Recently Sold", color: "text-emerald-500", bg: "bg-emerald-500/10", days: diffDays };
  }

  const daysIntoYear = diffDays % 365;

  if (daysIntoYear >= 335) {
    return { label: "Service Due Soon", color: "text-yellow-500", bg: "bg-yellow-500/10", days: diffDays };
  }

  return { label: "Healthy", color: "text-blue-500", bg: "bg-blue-500/10", days: diffDays };
};

const StatusBadge = ({ status, label }: { status: 'ok' | 'due_soon' | 'overdue'; label: string }) => {
  if (status === 'ok') return null;
  
  return (
    <Badge 
      variant="outline"
      className={status === 'overdue' 
        ? 'border-red-500 text-red-500 bg-red-500/10' 
        : 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
      }
    >
      {label}
    </Badge>
  );
};

// Hook for updating DIC amount
const useUpdateDealDIC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, dicAmount }: { dealId: string; dicAmount: number }) => {
      const { error } = await supabase
        .from('deal_records')
        .update({ dic_amount: dicAmount })
        .eq('id', dealId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-records'] });
      toast.success('DIC amount updated');
    },
    onError: () => {
      toast.error('Failed to update DIC amount');
    },
  });
};

// Deal Management Modal Component
const DealManagementModal = ({ deal, open, onOpenChange }: { deal: DealRecord; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const addExpense = useAddDealExpense();
  const logService = useLogServiceRecord();
  const updateDIC = useUpdateDealDIC();
  const { data: documents = [] } = useClientDocuments(deal.application?.id);
  
  const [expenseType, setExpenseType] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceMileage, setServiceMileage] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  const [dicAmount, setDicAmount] = useState(deal.dic_amount || 0);
  const [isEditingDIC, setIsEditingDIC] = useState(false);

  const currentExpensesTotal = (deal.aftersales_expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const costPrice = deal.cost_price || deal.vehicle?.cost_price || deal.vehicle?.purchase_price || 0;
  const reconCost = deal.recon_cost || deal.vehicle?.reconditioning_cost || 0;
  const currentDIC = deal.dic_amount || 0;
  
  // Calculate profit (including DIC)
  let originalProfit: number;
  let currentProfit: number;
  
  if (deal.is_shared_capital && deal.partner_split_percent) {
    const baseProfit = (deal.sold_price || 0) - costPrice - reconCost + currentDIC;
    const partnerPayout = baseProfit * (deal.partner_split_percent / 100);
    const luminaRetained = baseProfit - partnerPayout;
    originalProfit = luminaRetained - (deal.sales_rep_commission || 0);
    currentProfit = originalProfit - currentExpensesTotal;
  } else {
    originalProfit = (deal.sold_price || 0) - costPrice - reconCost + currentDIC - (deal.sales_rep_commission || 0);
    currentProfit = originalProfit - currentExpensesTotal;
  }

  const handleSaveDIC = () => {
    updateDIC.mutate({ dealId: deal.id, dicAmount });
    setIsEditingDIC(false);
  };

  const handleAddExpense = () => {
    if (!expenseType.trim() || !expenseAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    addExpense.mutate({
      dealId: deal.id,
      expense: { type: expenseType.trim(), amount: parseFloat(expenseAmount) },
      currentExpenses: deal.aftersales_expenses || [],
    });
    
    setExpenseType('');
    setExpenseAmount('');
  };

  const handleLogService = () => {
    if (!serviceDate || !serviceMileage || !workshopName) {
      toast.error('Please fill in service date, mileage and workshop name');
      return;
    }

    if (!deal.vehicle_id) {
      toast.error('No vehicle linked to this deal');
      return;
    }

    logService.mutate({
      vehicleId: deal.vehicle_id,
      dealId: deal.id,
      serviceDate,
      serviceMileage: parseInt(serviceMileage),
      workshopName,
      serviceCost: serviceCost ? parseFloat(serviceCost) : 0,
      currentExpenses: deal.aftersales_expenses || [],
    });

    setServiceDate('');
    setServiceMileage('');
    setWorkshopName('');
    setServiceCost('');
    onOpenChange(false);
  };

  const serviceDue = getServiceDueStatus(deal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Deal Management
            {serviceDue.isDue && (
              <Badge variant="destructive" className="text-xs">Service Overdue</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {deal.vehicle && `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`} • 
            {deal.application && ` ${deal.application.first_name} ${deal.application.last_name}`}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="service" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="service" className="gap-2">
              <Wrench className="w-4 h-4" />
              Service
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="w-4 h-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Service Tab */}
          <TabsContent value="service" className="flex-1 overflow-auto">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 p-1">
                {/* Current Service Status */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Service Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Next Service Date</p>
                        <p className="font-medium">
                          {deal.next_service_date 
                            ? format(new Date(deal.next_service_date), 'dd MMM yyyy')
                            : 'Not set'
                          }
                        </p>
                        {serviceDue.isDue && (
                          <Badge variant="destructive" className="mt-1 text-xs">{serviceDue.reason}</Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Next Service KM</p>
                        <p className="font-medium">
                          {deal.next_service_km ? `${deal.next_service_km.toLocaleString()} km` : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Mileage</p>
                        <p className="font-medium">
                          {deal.sold_mileage ? `${deal.sold_mileage.toLocaleString()} km` : 'Not recorded'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sale Date</p>
                        <p className="font-medium">{format(new Date(deal.created_at), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Log Service Form */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Log Service Record
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Service Date</Label>
                        <Input
                          type="date"
                          value={serviceDate}
                          onChange={(e) => setServiceDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mileage at Service</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 45000"
                          value={serviceMileage}
                          onChange={(e) => setServiceMileage(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Workshop Name</Label>
                        <Input
                          placeholder="e.g., Toyota Sandton"
                          value={workshopName}
                          onChange={(e) => setWorkshopName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Service Cost (R) - Optional</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={serviceCost}
                          onChange={(e) => setServiceCost(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button onClick={handleLogService} disabled={logService.isPending} className="w-full">
                      {logService.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wrench className="w-4 h-4 mr-2" />}
                      Log Service & Update Next Date
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      This will set the next service date to 1 year from the service date
                    </p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="flex-1 overflow-auto">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 p-1">
                {/* Profit Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Profit Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-secondary/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Original Profit</p>
                        <p className={`text-xl font-bold ${originalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPrice(originalProfit)}
                        </p>
                      </div>
                      <div className="p-3 bg-secondary/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Current Profit</p>
                        <p className={`text-xl font-bold ${currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPrice(currentProfit)}
                        </p>
                      </div>
                    </div>
                    {currentExpensesTotal > 0 && (
                      <p className="text-xs text-red-400 mt-2">
                        Post-sale expenses: -{formatPrice(currentExpensesTotal)}
                      </p>
                    )}
                    {currentDIC > 0 && (
                      <p className="text-xs text-emerald-400 mt-1">
                        DIC/Bank Reward: +{formatPrice(currentDIC)}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* DIC / Bank Reward Section */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
                      <DollarSign className="w-4 h-4" />
                      Bank Reward / DIC
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditingDIC ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>DIC Amount (R)</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={dicAmount}
                            onChange={(e) => setDicAmount(parseFloat(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Dealer Incentive Commission from bank. Updates profit calculations.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveDIC} disabled={updateDIC.isPending} size="sm">
                            {updateDIC.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                            Save
                          </Button>
                          <Button onClick={() => { setIsEditingDIC(false); setDicAmount(deal.dic_amount || 0); }} variant="ghost" size="sm">
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-emerald-400">{formatPrice(currentDIC)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Pure profit from bank incentive</p>
                        </div>
                        <Button onClick={() => setIsEditingDIC(true)} variant="outline" size="sm">
                          <Edit2 className="w-4 h-4 mr-1" />
                          {currentDIC > 0 ? 'Edit' : 'Add'} DIC
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Current Expenses */}
                {(deal.aftersales_expenses || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Existing Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {deal.aftersales_expenses!.map((exp, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                            <span className="text-sm">{exp.type}</span>
                            <span className="text-red-400 font-medium">-{formatPrice(exp.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Add Expense Form */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Post-Sale Expense
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          placeholder="e.g., Traffic Fine, Repair"
                          value={expenseType}
                          onChange={(e) => setExpenseType(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount (R)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddExpense} disabled={addExpense.isPending} variant="outline" className="w-full">
                      {addExpense.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Add Expense
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="flex-1 overflow-auto">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 p-1">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Digital Glovebox</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No documents uploaded</p>
                        <p className="text-sm">Documents from the finance application will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(doc.uploaded_at), 'dd MMM yyyy HH:mm')}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from('client-docs')
                                  .createSignedUrl(doc.file_path, 3600);
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, '_blank');
                                }
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const AdminAftersales = () => {
  const queryClient = useQueryClient();
  const { data: aftersalesRecords = [], isLoading: aftersalesLoading } = useAftersalesRecords();
  const { data: dealRecords = [], isLoading: dealsLoading } = useDealRecords();
  const updateNotes = useUpdateAftersalesNotes();
  const rollbackDeal = useRollbackDeal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AftersalesRecord | null>(null);
  const [manageDeal, setManageDeal] = useState<DealRecord | null>(null);
  const [editDeal, setEditDeal] = useState<DealRecord | null>(null);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());

  // Lock/Unlock state
  const [unlockingDealId, setUnlockingDealId] = useState<string | null>(null);
  const [adminPinInput, setAdminPinInput] = useState('');

  // PDF generation state
  const [pdfDeal, setPdfDeal] = useState<DealRecord | null>(null);
  const [pdfExpenses, setPdfExpenses] = useState<{ description: string; amount: number; category: string }[]>([]);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // --- PDF GENERATION ENGINE ---
  const generatePDF = async (deal: DealRecord) => {
    // Fetch vehicle expenses for the ledger
    let expenses: { description: string; amount: number; category: string }[] = [];
    if (deal.vehicle_id) {
      const { data } = await (supabase as any)
        .from('vehicle_expenses')
        .select('description, amount, category')
        .eq('vehicle_id', deal.vehicle_id);
      if (data) expenses = data;
    }
    setPdfExpenses(expenses);
    setPdfDeal(deal);
    setIsReportPreviewOpen(true);
  };

  const downloadPDF = async () => {
    const input = document.getElementById('report-preview-container');
    if (!input) {
      toast.error('Report element not found.');
      return;
    }
    try {
      toast.info('Generating PDF...');
      
      // Clone the element to document body to bypass modal scroll/clipping
      const clone = input.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-10000px';
      clone.style.left = '0';
      clone.style.zIndex = '9999';
      clone.style.width = '210mm';
      clone.style.height = 'auto';
      clone.style.background = '#ffffff';
      clone.style.color = '#000000';
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const regNum = pdfDeal?.vehicle?.model || pdfDeal?.id.slice(0, 8) || 'Report';
      pdf.save(`Partner_Report_${regNum}.pdf`);
      toast.success('Report downloaded.');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Could not generate PDF report.');
    }
  };

  // Lock/Unlock handlers
  const handleToggleLock = async (deal: DealRecord) => {
    if (deal.is_closed) {
      // Need PIN to unlock
      setUnlockingDealId(deal.id);
    } else {
      // Lock it
      if (confirm('Finalize this deal? This will lock the financial data.')) {
        await supabase.from('deal_records').update({ is_closed: true } as any).eq('id', deal.id);
        toast.success('Deal finalized and locked.');
        queryClient.invalidateQueries({ queryKey: ['deal-records'] });
      }
    }
  };

  const handleUnlockWithPin = async () => {
    if (adminPinInput === 'Lumina2026') {
      await supabase.from('deal_records').update({ is_closed: false } as any).eq('id', unlockingDealId);
      toast.success('Deal unlocked for editing.');
      setUnlockingDealId(null);
      setAdminPinInput('');
      queryClient.invalidateQueries({ queryKey: ['deal-records'] });
    } else {
      toast.error('Incorrect Admin PIN.');
    }
  };

  // === GROUP DEALS BY MONTH ===
  const groupedDealRecords = useMemo(() => {
    const groups: Record<string, DealRecord[]> = {};
    dealRecords.forEach(deal => {
      const date = deal.sale_date ? parseISO(deal.sale_date) : new Date(deal.created_at);
      const key = format(date, 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(deal);
    });
    return groups;
  }, [dealRecords]);

  const isLoading = aftersalesLoading || dealsLoading;

  // === CURRENT MONTH FILTER ===
  const currentMonthDeals = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return dealRecords.filter(deal => {
      const saleDate = deal.sale_date ? new Date(deal.sale_date) : new Date(deal.created_at);
      return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
    });
  }, [dealRecords]);

  // === CLIENT-SIDE ANALYTICS CALCULATION (Current Month Only) ===
  // Total Net Profit = Sum of gross_profit column (which is Lumina Net Profit BEFORE commission)
  const totalNetProfit = currentMonthDeals.reduce((sum, deal) => {
    return sum + (deal.gross_profit || 0);
  }, 0);

  // Total sales commission payable (separate tracking)
  const totalSalesCommission = currentMonthDeals.reduce((sum, deal) => {
    return sum + (deal.sales_rep_commission || 0);
  }, 0);
  
  // Total referral commission paid (expense)
  const totalReferralCommission = currentMonthDeals.reduce((sum, deal) => {
    return sum + (deal.referral_commission_amount || 0);
  }, 0);
  
  // Total commission payable = Sales + Referral commissions
  const totalCommissionPayable = totalSalesCommission + totalReferralCommission;
  
  // Total DIC earned
  const totalDIC = currentMonthDeals.reduce((sum, deal) => {
    return sum + (deal.dic_amount || 0);
  }, 0);
  
  // Average profit per unit
  const avgProfitPerUnit = currentMonthDeals.length > 0 ? totalNetProfit / currentMonthDeals.length : 0;
  
  // === LAST MONTH FILTER ===
  const lastMonthDeals = useMemo(() => {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    const monthStart = startOfMonth(lastMonth);
    const monthEnd = endOfMonth(lastMonth);
    
    return dealRecords.filter(deal => {
      const saleDate = deal.sale_date ? parseISO(deal.sale_date) : new Date(deal.created_at);
      return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
    });
  }, [dealRecords]);

  // === COMMISSION LEDGER HELPER ===
  const getCommissionByPerson = (dealList: DealRecord[]) => {
    const ledger: Record<string, number> = {};
    dealList.forEach(deal => {
      const person = deal.sales_rep_name || 'Admin';
      const comm = Number(deal.sales_rep_commission || 0);
      ledger[person] = (ledger[person] || 0) + comm;
    });
    return ledger;
  };

  const thisMonthLedger = getCommissionByPerson(currentMonthDeals);
  const lastMonthLedger = getCommissionByPerson(lastMonthDeals);

  // Count deals with zero cost_price (data quality warning)
  const zeroCostDealsCount = dealRecords.filter(deal => !deal.cost_price || deal.cost_price === 0).length;
  
  // Service alerts
  const serviceAlertCount = dealRecords.filter(deal => getServiceDueStatus(deal).isDue).length;

  const startEditing = (record: AftersalesRecord) => {
    setEditingId(record.id);
    setEditNotes(record.notes || '');
  };

  const saveNotes = async () => {
    if (!editingId) return;
    await updateNotes.mutateAsync({ id: editingId, notes: editNotes });
    setEditingId(null);
    setEditNotes('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditNotes('');
  };

  const openWhatsApp = (phone: string | null, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    const cleanedPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanedPhone.startsWith('0') ? `27${cleanedPhone.slice(1)}` : cleanedPhone;
    const message = `Hi ${name}, this is Lumina Auto. We hope you're enjoying your vehicle! We wanted to check in regarding your upcoming service.`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const toggleDealExpand = (dealId: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  const sortedRecords = [...aftersalesRecords].sort((a, b) => {
    const aStatus = getServiceStatus(a.sale_date);
    const bStatus = getServiceStatus(b.sale_date);
    const aUrgent = aStatus.serviceStatus !== 'ok' || aStatus.tradeInStatus !== 'ok';
    const bUrgent = bStatus.serviceStatus !== 'ok' || bStatus.tradeInStatus !== 'ok';
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return 0;
  });

  const alertCount = aftersalesRecords.filter(r => {
    const status = getServiceStatus(r.sale_date);
    return status.serviceStatus !== 'ok' || status.tradeInStatus !== 'ok';
  }).length;

  return (
    <AdminLayout>
      <Helmet>
        <title>Aftersales | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-semibold mb-2">Aftersales</h1>
          <p className="text-muted-foreground">Manage customer relationships and deal lifecycle post-sale</p>
        </motion.div>

        {/* This Month's Performance Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">This Month's Performance</h2>
            <Badge variant="outline" className="text-xs">{format(new Date(), 'MMMM yyyy')}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-sm text-muted-foreground">Net Profit</p>
              </div>
              <p className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPrice(totalNetProfit)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{currentMonthDeals.length} units</p>
            </div>
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-4 h-4 text-purple-400" />
                <p className="text-sm text-muted-foreground">Avg / Unit</p>
              </div>
              <p className={`text-2xl font-bold ${avgProfitPerUnit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                {formatPrice(avgProfitPerUnit)}
              </p>
            </div>
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <p className="text-sm text-muted-foreground">DIC Earned</p>
              </div>
              <p className="text-2xl font-bold text-cyan-400">{formatPrice(totalDIC)}</p>
            </div>

            {/* COMMISSION BOARD: LAST MONTH */}
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Commissions (Last Month)</p>
                </div>
                <Badge variant="outline" className="text-xs">Paid Out</Badge>
              </div>
              <div className="space-y-1">
                {Object.keys(lastMonthLedger).length === 0 && (
                  <p className="text-xs text-muted-foreground">No commissions recorded.</p>
                )}
                {Object.entries(lastMonthLedger).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-medium">{formatPrice(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* COMMISSION BOARD: THIS MONTH */}
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-semibold">Commissions (Current)</p>
                </div>
                <Badge variant="outline" className="text-xs">Pending</Badge>
              </div>
              <div className="space-y-1">
                {Object.keys(thisMonthLedger).length === 0 && (
                  <p className="text-xs text-muted-foreground">No sales yet this month.</p>
                )}
                {Object.entries(thisMonthLedger).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-medium text-emerald-400">{formatPrice(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Service Alert Banner */}
        {serviceAlertCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
          >
            <Wrench className="w-5 h-5 text-red-500" />
            <p className="text-sm">
              <span className="font-semibold">{serviceAlertCount} deal(s)</span> have overdue service dates. Click on the row to manage.
            </p>
          </motion.div>
        )}

        {/* Zero Cost Warning Banner */}
        {zeroCostDealsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-sm">
              <span className="font-semibold">{zeroCostDealsCount} deal(s)</span> have R0 cost price recorded, which may inflate profit figures. Edit these deals to correct.
            </p>
          </motion.div>
        )}

        {/* Deal Records Table */}
        {/* Deal Records - Grouped by Month */}
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : dealRecords.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-xl p-8 text-center text-muted-foreground mb-8"
          >
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No finalized deals yet</p>
          </motion.div>
        ) : (
          Object.entries(groupedDealRecords).map(([month, monthDeals]) => (
            <motion.div
              key={month}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-xl overflow-hidden mb-6"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{month}</h2>
                  <p className="text-sm text-muted-foreground">{monthDeals.length} deal{monthDeals.length !== 1 ? 's' : ''}</p>
                </div>
                <Badge variant="outline">
                  {formatPrice(monthDeals.reduce((sum, d) => sum + (d.gross_profit || 0), 0))} profit
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-muted-foreground w-8"></TableHead>
                      <TableHead className="text-muted-foreground">Client & Vehicle</TableHead>
                      <TableHead className="text-muted-foreground">Sold Price</TableHead>
                      <TableHead className="text-muted-foreground">Net Profit</TableHead>
                      <TableHead className="text-muted-foreground">Health</TableHead>
                      <TableHead className="text-muted-foreground">Status / Date</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthDeals.map((deal) => {
                      const serviceDue = getServiceDueStatus(deal);
                      const netProfit = deal.gross_profit || 0;
                      const hasZeroCost = !deal.cost_price || deal.cost_price === 0;
                      const isLocked = !!deal.is_closed;
                      
                      return (
                        <TableRow 
                          key={deal.id} 
                          className={`border-white/10 hover:bg-white/5 cursor-pointer ${serviceDue.isDue ? 'bg-red-500/5' : ''} ${isLocked ? 'opacity-80' : ''}`}
                          onClick={() => {
                            if (isLocked) {
                              toast.info('This deal is locked. Unlock it first to edit.');
                            } else {
                              setEditDeal(deal);
                            }
                          }}
                        >
                          <TableCell className="w-8">
                            {isLocked && (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            )}
                            {!isLocked && serviceDue.isDue && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            {!isLocked && !serviceDue.isDue && hasZeroCost && (
                              <span title="Zero cost price">
                                <AlertCircle className="w-4 h-4 text-yellow-500" />
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {deal.application?.first_name} {deal.application?.last_name}
                              </p>
                              {deal.vehicle ? (
                                <p className="text-xs text-muted-foreground">
                                  {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Vehicle removed</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold">{deal.sold_price ? formatPrice(deal.sold_price) : 'N/A'}</p>
                              {(deal.aftersales_expenses || []).length > 0 && (
                                <p className="text-xs text-red-400">
                                  -{formatPrice((deal.aftersales_expenses || []).reduce((s, e) => s + (e.amount || 0), 0))} post-sale
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatPrice(netProfit)}
                              </p>
                              {hasZeroCost && (
                                <p className="text-xs text-yellow-500">⚠ No cost recorded</p>
                              )}
                              {deal.sales_rep_commission && deal.sales_rep_commission > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  -{formatPrice(deal.sales_rep_commission)} comm.
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const healthStatus = getVehicleHealthStatus(deal.sale_date);
                              return (
                                <div className="group relative flex items-center">
                                  <span className={`px-2 py-1 rounded text-xs font-bold border border-transparent cursor-help ${healthStatus.bg} ${healthStatus.color}`}>
                                    {healthStatus.label}
                                  </span>
                                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-max bg-black text-white text-[10px] px-2 py-1 rounded border border-zinc-700 z-50 shadow-xl">
                                    Owned: {healthStatus.days} days
                                    <br/>
                                    Date: {deal.sale_date}
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{format(new Date(deal.created_at), 'dd MMM yyyy')}</p>
                              {isLocked && (
                                <Badge variant="outline" className="text-xs mt-1 border-muted-foreground/30">
                                  <Lock className="w-3 h-3 mr-1" /> Finalized
                                </Badge>
                              )}
                              {!isLocked && deal.next_service_date && (
                                <div className="mt-1">
                                  {serviceDue.isDue ? (
                                    <Badge variant="destructive" className="text-xs">Service Overdue</Badge>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Service: {format(new Date(deal.next_service_date), 'dd MMM')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Lock/Unlock Toggle */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className={isLocked ? 'text-muted-foreground hover:text-foreground' : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'}
                                onClick={() => handleToggleLock(deal)}
                                title={isLocked ? 'Unlock Deal (Requires PIN)' : 'Finalize & Lock Deal'}
                              >
                                {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </Button>
                              {!isLocked && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-purple-500 hover:text-purple-400 hover:bg-purple-500/10"
                                    onClick={() => setEditDeal(deal)}
                                    title="Edit Deal Structure"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {deal.is_shared_capital && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                  onClick={() => generatePDF(deal)}
                                  title="Download Partner Report"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                                onClick={() => setManageDeal(deal)}
                                title="Manage Deal Lifecycle"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <HandoverSetupModal dealId={deal.id} currentPhotos={(deal as any).delivery_photos || []} />
                              {!isLocked && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                                      title="Undo Deal / Return to Finance"
                                    >
                                      <Undo2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Undo This Deal?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will:
                                        <ul className="list-disc list-inside mt-2 space-y-1">
                                          <li>Return the finance application status to "Approved"</li>
                                          <li>Set the vehicle status back to "Available"</li>
                                          <li>Delete this deal record permanently</li>
                                        </ul>
                                        <p className="mt-3 font-medium">This action cannot be undone.</p>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => rollbackDeal.mutate({
                                          dealId: deal.id,
                                          applicationId: deal.application_id,
                                          vehicleId: deal.vehicle_id,
                                        })}
                                        className="bg-amber-600 hover:bg-amber-700"
                                      >
                                        Undo Deal
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          ))
        )}

        {/* Aftersales Follow-up Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">Customer Follow-ups</h2>
          </div>
          {aftersalesLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : aftersalesRecords.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No aftersales records yet</p>
              <p className="text-sm mt-1">Finalized deals will appear here for follow-up</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-muted-foreground">Vehicle</TableHead>
                  <TableHead className="text-muted-foreground">Sale Date</TableHead>
                  <TableHead className="text-muted-foreground">Alerts</TableHead>
                  <TableHead className="text-muted-foreground">Notes</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((record) => {
                  const status = getServiceStatus(record.sale_date);
                  const hasAlert = status.serviceStatus !== 'ok' || status.tradeInStatus !== 'ok';

                  return (
                    <TableRow 
                      key={record.id} 
                      className={`border-white/10 hover:bg-white/5 ${hasAlert ? 'bg-yellow-500/5' : ''}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{record.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.vehicle ? (
                          <div>
                            <p className="font-medium">
                              {record.vehicle.year} {record.vehicle.make} {record.vehicle.model}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(record.vehicle.price)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Vehicle removed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{format(new Date(record.sale_date), 'dd MMM yyyy')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {status.years} year{status.years !== 1 ? 's' : ''} ago
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={status.serviceStatus} label="Service Due" />
                          <StatusBadge status={status.tradeInStatus} label="Trade-In Follow-up" />
                          {!hasAlert && (
                            <span className="text-xs text-muted-foreground">No alerts</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {editingId === record.id ? (
                          <div className="flex flex-col gap-2">
                            <Textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Add notes..."
                              rows={2}
                              className="text-sm"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={saveNotes}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-muted-foreground truncate">
                              {record.notes || 'No notes'}
                            </p>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="shrink-0"
                              onClick={() => startEditing(record)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedRecord(record)}
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                            onClick={() => openWhatsApp(record.customer_phone, record.customer_name)}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </motion.div>

        {/* Client Profile Modal */}
        {selectedRecord && (
          <ClientProfileModal
            isOpen={!!selectedRecord}
            onClose={() => setSelectedRecord(null)}
            record={selectedRecord}
          />
        )}

        {/* Deal Management Modal */}
        {manageDeal && (
          <DealManagementModal
            deal={manageDeal}
            open={!!manageDeal}
            onOpenChange={(open) => !open && setManageDeal(null)}
          />
        )}

        {/* Edit Deal Structure Modal */}
        {editDeal && (
          <FinalizeDealModal
            isOpen={!!editDeal}
            onClose={() => setEditDeal(null)}
            applicationId={editDeal.application_id || ''}
            vehicleId={editDeal.vehicle_id || ''}
            vehiclePrice={editDeal.vehicle?.price || editDeal.sold_price || 0}
            vehicleMileage={editDeal.sold_mileage || 0}
            vehicleStatus="sold"
            vehicle={editDeal.vehicle ? {
              year: editDeal.vehicle.year,
              make: editDeal.vehicle.make,
              model: editDeal.vehicle.model,
              cost_price: editDeal.vehicle.cost_price,
              purchase_price: editDeal.vehicle.purchase_price,
              reconditioning_cost: editDeal.vehicle.reconditioning_cost,
            } : null}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['deal-records'] });
              setEditDeal(null);
            }}
            existingDeal={editDeal as ExistingDealData}
          />
        )}

        {/* Unlock PIN Dialog */}
        <Dialog open={!!unlockingDealId} onOpenChange={(open) => { if (!open) { setUnlockingDealId(null); setAdminPinInput(''); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Unlock className="w-5 h-5" />
                Admin Unlock
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter Admin PIN to unlock this finalized deal for editing.</p>
              <Input
                type="password"
                placeholder="Enter PIN..."
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockWithPin()}
              />
              <Button onClick={handleUnlockWithPin} className="w-full">
                <Unlock className="w-4 h-4 mr-2" />
                Unlock Deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* --- REPORT PREVIEW MODAL --- */}
        <Dialog open={isReportPreviewOpen} onOpenChange={(open) => { if (!open) { setIsReportPreviewOpen(false); setPdfDeal(null); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Partner Report Preview
              </DialogTitle>
              <DialogDescription>
                Review the report below, then download as PDF.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mb-2">
              <Button variant="outline" onClick={() => { setIsReportPreviewOpen(false); setPdfDeal(null); }}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <Button onClick={downloadPDF} className="bg-emerald-600 hover:bg-emerald-700">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
            <ScrollArea className="flex-1 overflow-auto">
              {pdfDeal && (() => {
                const vehicle = pdfDeal.vehicle;
                const sellingPrice = Number(pdfDeal.sold_price || 0);
                const discount = Number(pdfDeal.discount_amount || 0);
                const soldPriceNet = sellingPrice - discount;
                const vehicleCost = Number(pdfDeal.cost_price || 0);
                const partnerCapital = Number((pdfDeal as any).partner_capital_contribution || 0) || vehicleCost;
                const grossProfit = soldPriceNet - vehicleCost;
                // Combine vehicle_expenses (pre-sale) and aftersales_expenses (post-sale) for full line items
                const allLineItems = [
                  ...pdfExpenses.map(e => ({ description: e.description, amount: e.amount, category: e.category })),
                  ...(pdfDeal.aftersales_expenses || []).map(e => ({ description: e.type, amount: e.amount, category: 'Post-Sale' })),
                ];
                const totalDeductions = allLineItems.reduce((s, e) => s + Number(e.amount || 0), 0);
                const netSharedProfit = grossProfit - totalDeductions;

                const partnerPercent = pdfDeal.partner_split_type === 'percentage'
                  ? (Number(pdfDeal.partner_split_value || 0) / 100)
                  : 0;
                const partnerShareAmount = pdfDeal.partner_split_type === 'percentage'
                  ? netSharedProfit * partnerPercent
                  : Number(pdfDeal.partner_profit_amount || 0);
                const luminaShareAmount = netSharedProfit - partnerShareAmount;
                const partnerPayoutTotal = partnerCapital + partnerShareAmount;

                const fmtPrice = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                return (
                  <div id="report-preview-container" ref={reportRef} style={{ width: '100%', maxWidth: '794px', margin: '0 auto', padding: '40px', background: '#ffffff', color: '#111', fontFamily: 'Arial, sans-serif' }}>
                    {/* HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #111', paddingBottom: '16px', marginBottom: '24px' }}>
                      <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>PARTNER PAYOUT REPORT</h1>
                        <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>Confidential — Internal Use Only</p>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
                        <p style={{ margin: 0 }}>Date: {format(new Date(), 'dd MMMM yyyy')}</p>
                        <p style={{ margin: '2px 0 0' }}>Ref: {pdfDeal.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>

                    {/* VEHICLE */}
                    <div style={{ marginBottom: '24px' }}>
                      <h2 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#999', marginBottom: '8px' }}>Vehicle</h2>
                      {vehicle ? (
                        <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{vehicle.year} {vehicle.make} {vehicle.model}</p>
                      ) : (
                        <p style={{ color: '#999' }}>Vehicle data not available</p>
                      )}
                    </div>

                    {/* FINANCIAL SUMMARY */}
                    <div style={{ marginBottom: '24px' }}>
                      <h2 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>Financial Summary (Metal Logic)</h2>
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ padding: '6px 0' }}>Sold Price (Net of Discount)</td><td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 500 }}>{fmtPrice(soldPriceNet)}</td></tr>
                          <tr style={{ color: '#c00' }}><td style={{ padding: '6px 0' }}>(Less) Vehicle Cost / Capital</td><td style={{ padding: '6px 0', textAlign: 'right' }}>-{fmtPrice(vehicleCost)}</td></tr>
                          <tr style={{ borderTop: '1px solid #ddd' }}><td style={{ padding: '8px 0', fontWeight: 'bold' }}>GROSS PROFIT</td><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>{fmtPrice(grossProfit)}</td></tr>
                          <tr><td colSpan={2} style={{ padding: '4px 0' }}><hr style={{ border: 'none', borderTop: '1px solid #eee' }} /></td></tr>
                          <tr style={{ color: '#c00' }}><td style={{ padding: '6px 0' }}>(Less) Total Expenses</td><td style={{ padding: '6px 0', textAlign: 'right' }}>-{fmtPrice(totalDeductions)}</td></tr>
                          <tr style={{ borderTop: '2px solid #111' }}><td style={{ padding: '8px 0', fontWeight: 'bold', fontSize: '14px' }}>NET SHARED PROFIT</td><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>{fmtPrice(netSharedProfit)}</td></tr>
                        </tbody>
                      </table>
                    </div>

                    {/* EXPENSE LEDGER */}
                    {allLineItems.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>Expense Breakdown (Full Ledger)</h2>
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #ccc' }}>
                              <th style={{ textAlign: 'left', padding: '4px 0', color: '#666', fontWeight: 500 }}>Description</th>
                              <th style={{ textAlign: 'left', padding: '4px 0', color: '#666', fontWeight: 500 }}>Category</th>
                              <th style={{ textAlign: 'right', padding: '4px 0', color: '#666', fontWeight: 500 }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allLineItems.map((exp, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '4px 0' }}>{exp.description}</td>
                                <td style={{ padding: '4px 0', color: '#666', textTransform: 'capitalize' }}>{exp.category}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmtPrice(exp.amount)}</td>
                              </tr>
                            ))}
                            <tr style={{ fontWeight: 600 }}>
                              <td style={{ padding: '6px 0' }} colSpan={2}>Total</td>
                              <td style={{ padding: '6px 0', textAlign: 'right' }}>{fmtPrice(allLineItems.reduce((s, e) => s + e.amount, 0))}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* PARTNER DISTRIBUTION */}
                    <div style={{ marginBottom: '24px', padding: '20px', background: '#f5f5f5', border: '2px solid #111', borderRadius: '8px' }}>
                      <h2 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>Partner Distribution</h2>
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '6px 0' }}>Partner Share ({pdfDeal.partner_split_type === 'percentage' ? `${Number(pdfDeal.partner_split_value || 0)}%` : 'Fixed'})</td>
                            <td style={{ padding: '6px 0', textAlign: 'right' }}>{fmtPrice(partnerShareAmount)}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 0' }}>(+) Capital Refund</td>
                            <td style={{ padding: '6px 0', textAlign: 'right' }}>{fmtPrice(partnerCapital)}</td>
                          </tr>
                          <tr style={{ borderTop: '2px solid #111' }}>
                            <td style={{ padding: '8px 0', fontWeight: 'bold', fontSize: '15px' }}>FINAL PAYOUT TO PARTNER</td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#0a6b3d' }}>{fmtPrice(partnerPayoutTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* LUMINA KEEPS */}
                    <div style={{ marginBottom: '24px', padding: '16px', background: '#eef4ff', border: '1px solid #b3d0ff', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600 }}>Lumina Retains</span>
                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{fmtPrice(totalDeductions + luminaShareAmount)}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#4477bb', margin: '4px 0 0' }}>Reimbursement ({fmtPrice(totalDeductions)}) + Profit Share ({fmtPrice(luminaShareAmount)})</p>
                    </div>

                    {/* FOOTER */}
                    <div style={{ borderTop: '1px solid #ccc', paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#999' }}>
                      <p style={{ margin: 0 }}>This document is auto-generated by Lumina Auto DMS. All figures subject to final reconciliation.</p>
                      <p style={{ margin: '4px 0 0' }}>© {new Date().getFullYear()} Lumina Auto. Confidential.</p>
                      <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#bbb' }}>* Excludes external Banking Fees, Admin Fees, and DIC rewards.</p>
                    </div>
                  </div>
                );
              })()}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAftersales;
