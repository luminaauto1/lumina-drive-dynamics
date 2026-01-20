import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Package, Calendar, AlertCircle, Loader2, MessageCircle, Edit2, Save, X, Eye, Undo2, TrendingUp, DollarSign, Users, Plus, Receipt } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, differenceInYears, format } from 'date-fns';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientProfileModal from '@/components/admin/ClientProfileModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';

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
  aftersales_expenses: Array<{ type: string; amount: number }> | null;
  created_at: string;
  vehicle?: {
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    purchase_price?: number;
    reconditioning_cost?: number;
  };
  application?: {
    first_name: string | null;
    last_name: string | null;
    full_name: string;
    email: string;
    phone: string;
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

const useDealRecords = () => {
  return useQuery({
    queryKey: ['deal-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select(`
          *,
          vehicle:vehicles(make, model, variant, year, price, purchase_price, reconditioning_cost),
          application:finance_applications(first_name, last_name, full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DealRecord[];
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
      // 1. Update finance application status back to approved
      if (applicationId) {
        const { error: appError } = await supabase
          .from('finance_applications')
          .update({ status: 'approved' })
          .eq('id', applicationId);
        if (appError) throw appError;
      }

      // 2. Update vehicle status back to available
      if (vehicleId) {
        const { error: vehicleError } = await supabase
          .from('vehicles')
          .update({ status: 'available' })
          .eq('id', vehicleId);
        if (vehicleError) throw vehicleError;
      }

      // 3. Delete the deal record
      const { error: dealError } = await supabase
        .from('deal_records')
        .delete()
        .eq('id', dealId);
      if (dealError) throw dealError;

      // 4. Delete associated aftersales record if exists
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

// Add expense to deal record mutation
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

// TASK 3 FIX: Proper service due badge logic - only show if date is STRICTLY in the past
const getServiceDueStatus = (deal: DealRecord) => {
  if (!deal.next_service_date) return { isDue: false, reason: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
  
  const serviceDate = new Date(deal.next_service_date);
  serviceDate.setHours(0, 0, 0, 0);
  
  // Only true if date is STRICTLY in the PAST (not today)
  if (serviceDate < today) {
    return { isDue: true, reason: 'Service Date Passed' };
  }
  
  return { isDue: false, reason: null };
};

const getServiceStatus = (saleDate: string) => {
  const days = differenceInDays(new Date(), new Date(saleDate));
  const years = differenceInYears(new Date(), new Date(saleDate));
  
  // Annual service: due every 365 days
  const daysSinceLastService = days % 365;
  const daysUntilNextService = 365 - daysSinceLastService;
  
  // 3-year follow-up
  const yearsRemaining = 3 - (years % 3);
  const daysUntil3Year = yearsRemaining * 365 - daysSinceLastService;
  
  let serviceStatus: 'ok' | 'due_soon' | 'overdue' = 'ok';
  let tradeInStatus: 'ok' | 'due_soon' | 'overdue' = 'ok';
  
  // Service: due soon if within 30 days, overdue if past
  if (daysUntilNextService <= 0 || daysUntilNextService > 335) {
    serviceStatus = 'overdue';
  } else if (daysUntilNextService <= 30) {
    serviceStatus = 'due_soon';
  }
  
  // 3-Year: due soon if within 90 days, approaching 3 year mark
  if (years >= 3 && daysUntil3Year <= 0) {
    tradeInStatus = 'overdue';
  } else if (daysUntil3Year <= 90 && daysUntil3Year > 0) {
    tradeInStatus = 'due_soon';
  }
  
  return { serviceStatus, tradeInStatus, daysUntilNextService, daysUntil3Year, years };
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

// Add Expense Dialog Component
const AddExpenseDialog = ({ deal, onClose }: { deal: DealRecord; onClose: () => void }) => {
  const addExpense = useAddDealExpense();
  const [expenseType, setExpenseType] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const handleSubmit = () => {
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
    onClose();
  };

  const currentExpensesTotal = (deal.aftersales_expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const purchasePrice = (deal.vehicle as any)?.purchase_price || 0;
  const reconditioningCost = (deal.vehicle as any)?.reconditioning_cost || 0;
  const currentProfit = (deal.sold_price || 0) - purchasePrice - reconditioningCost - currentExpensesTotal - (deal.sales_rep_commission || 0);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Post-Sale Expense</DialogTitle>
        <DialogDescription>
          {deal.vehicle && `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`}
        </DialogDescription>
      </DialogHeader>
      
      {/* Current Expenses */}
      {(deal.aftersales_expenses || []).length > 0 && (
        <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Existing Expenses:</p>
          {deal.aftersales_expenses!.map((exp, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{exp.type}</span>
              <span className="text-red-400">-{formatPrice(exp.amount)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
            <span>Current Profit</span>
            <span className={currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {formatPrice(currentProfit)}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="expenseType">Description</Label>
          <Input
            id="expenseType"
            placeholder="e.g., Late Recon, Tow Fee"
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expenseAmount">Amount (R)</Label>
          <Input
            id="expenseAmount"
            type="number"
            placeholder="0.00"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={addExpense.isPending}>
          {addExpense.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Add Expense
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const AdminAftersales = () => {
  const { data: aftersalesRecords = [], isLoading: aftersalesLoading } = useAftersalesRecords();
  const { data: dealRecords = [], isLoading: dealsLoading } = useDealRecords();
  const updateNotes = useUpdateAftersalesNotes();
  const rollbackDeal = useRollbackDeal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AftersalesRecord | null>(null);
  const [expenseDealId, setExpenseDealId] = useState<string | null>(null);

  const isLoading = aftersalesLoading || dealsLoading;

  // Calculate analytics from deal records (includes all expenses)
  const totalProfit = dealRecords.reduce((sum, deal) => {
    const soldPrice = deal.sold_price || 0;
    const purchasePrice = (deal.vehicle as any)?.purchase_price || 0;
    const reconditioningCost = (deal.vehicle as any)?.reconditioning_cost || 0;
    const expensesTotal = (deal.aftersales_expenses || []).reduce((e, exp) => e + (exp.amount || 0), 0);
    const commission = deal.sales_rep_commission || 0;
    return sum + (soldPrice - purchasePrice - reconditioningCost - expensesTotal - commission);
  }, 0);

  const totalCommission = dealRecords.reduce((sum, deal) => {
    return sum + (deal.sales_rep_commission || 0);
  }, 0);

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

  // Sort records to show alerts first
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
          <p className="text-muted-foreground">Manage customer relationships post-sale</p>
        </motion.div>

        {/* Analytics Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
        >
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-muted-foreground">Total Profit</p>
            </div>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPrice(totalProfit)}
            </p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Total Commission</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatPrice(totalCommission)}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </div>
            <p className="text-2xl font-bold">{dealRecords.length}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-yellow-400">{alertCount}</p>
            <p className="text-sm text-muted-foreground">Needs Attention</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">
              {aftersalesRecords.filter(r => getServiceStatus(r.sale_date).years >= 3).length}
            </p>
            <p className="text-sm text-muted-foreground">Trade-In Candidates</p>
          </div>
        </motion.div>

        {/* Alert Banner */}
        {alertCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-sm">
              <span className="font-semibold">{alertCount} customer(s)</span> need follow-up for service reminders or trade-in opportunities.
            </p>
          </motion.div>
        )}

        {/* Deal Records Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-xl overflow-hidden mb-8"
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">Deal Records</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : dealRecords.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No finalized deals yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-muted-foreground">Vehicle</TableHead>
                  <TableHead className="text-muted-foreground">Sold Price</TableHead>
                  <TableHead className="text-muted-foreground">Sales Rep</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealRecords.map((deal) => (
                  <TableRow key={deal.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {deal.application?.first_name} {deal.application?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{deal.application?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {deal.vehicle ? (
                        <p className="font-medium">
                          {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">Vehicle removed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{deal.sold_price ? formatPrice(deal.sold_price) : 'N/A'}</p>
                        {(deal.aftersales_expenses || []).length > 0 && (
                          <p className="text-xs text-red-400">
                            -{formatPrice((deal.aftersales_expenses || []).reduce((s, e) => s + (e.amount || 0), 0))} expenses
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{deal.sales_rep_name || 'N/A'}</p>
                        {deal.sales_rep_commission && (
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(deal.sales_rep_commission)} comm.
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(deal.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog open={expenseDealId === deal.id} onOpenChange={(open) => setExpenseDealId(open ? deal.id : null)}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                              title="Add Post-Sale Expense"
                            >
                              <Receipt className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <AddExpenseDialog deal={deal} onClose={() => setExpenseDealId(null)} />
                        </Dialog>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>

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
      </div>
    </AdminLayout>
  );
};

export default AdminAftersales;
