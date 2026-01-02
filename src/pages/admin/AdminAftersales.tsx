import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Package, Calendar, AlertCircle, Loader2, MessageCircle, Edit2, Save, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, differenceInYears, format } from 'date-fns';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';

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

const AdminAftersales = () => {
  const { data: records = [], isLoading } = useAftersalesRecords();
  const updateNotes = useUpdateAftersalesNotes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

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
  const sortedRecords = [...records].sort((a, b) => {
    const aStatus = getServiceStatus(a.sale_date);
    const bStatus = getServiceStatus(b.sale_date);
    const aUrgent = aStatus.serviceStatus !== 'ok' || aStatus.tradeInStatus !== 'ok';
    const bUrgent = bStatus.serviceStatus !== 'ok' || bStatus.tradeInStatus !== 'ok';
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return 0;
  });

  const alertCount = records.filter(r => {
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

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold">{records.length}</p>
            <p className="text-sm text-muted-foreground">Total Sales</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-yellow-400">{alertCount}</p>
            <p className="text-sm text-muted-foreground">Needs Attention</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">
              {records.filter(r => getServiceStatus(r.sale_date).years >= 3).length}
            </p>
            <p className="text-sm text-muted-foreground">Trade-In Candidates</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-400">
              {records.filter(r => {
                const days = differenceInDays(new Date(), new Date(r.sale_date));
                return days <= 30;
              }).length}
            </p>
            <p className="text-sm text-muted-foreground">This Month</p>
          </div>
        </motion.div>

        {/* Alert Banner */}
        {alertCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-sm">
              <span className="font-semibold">{alertCount} customer(s)</span> need follow-up for service reminders or trade-in opportunities.
            </p>
          </motion.div>
        )}

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No finalized sales yet</p>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                          onClick={() => openWhatsApp(record.customer_phone, record.customer_name)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default AdminAftersales;
