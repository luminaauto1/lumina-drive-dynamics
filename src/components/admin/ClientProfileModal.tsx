import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MessageSquare, FileText, History, Phone, Mail, Send, Upload, Loader2, Plus, Trash2, ChevronDown, Eye, Gavel, Package } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/hooks/useVehicles';
import { useClientActivities, useLogClientActivity } from '@/hooks/useClientActivities';
import { useDealAddons, useCreateDealAddon, useDeleteDealAddon, DealAddon } from '@/hooks/useDealAddons';

interface ClientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    sale_date: string;
    notes: string | null;
    finance_application_id: string | null;
    vehicle?: {
      make: string;
      model: string;
      variant: string | null;
      year: number;
      price: number;
    };
  };
}

const ClientProfileModal = ({ isOpen, onClose, record }: ClientProfileModalProps) => {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  
  // Addon form state
  const [addonName, setAddonName] = useState('');
  const [addonCost, setAddonCost] = useState('');
  const [addonSelling, setAddonSelling] = useState('');
  const [addonCategory, setAddonCategory] = useState<string>('accessory');

  // Hooks for data
  const { data: activities = [] } = useClientActivities(record.finance_application_id || undefined);
  const { data: addons = [] } = useDealAddons(record.finance_application_id || undefined);
  const logActivity = useLogClientActivity();
  const createAddon = useCreateDealAddon();
  const deleteAddon = useDeleteDealAddon();

  const handleAddComment = async () => {
    if (!newComment.trim() || !record.finance_application_id) return;
    await logActivity.mutateAsync({
      application_id: record.finance_application_id,
      action_type: 'note',
      details: newComment,
    });
    setNewComment('');
    toast.success('Comment added');
  };

  const handleAddAddon = async () => {
    if (!addonName.trim() || !record.finance_application_id) return;
    await createAddon.mutateAsync({
      application_id: record.finance_application_id,
      name: addonName,
      cost_price: parseFloat(addonCost) || 0,
      selling_price: parseFloat(addonSelling) || 0,
      category: addonCategory,
    });
    setAddonName('');
    setAddonCost('');
    setAddonSelling('');
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    try {
      const fileName = `${record.customer_id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('client-docs').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      if (record.finance_application_id) {
        await logActivity.mutateAsync({
          application_id: record.finance_application_id,
          action_type: 'document_uploaded',
          details: file.name,
        });
      }
      toast.success('Document uploaded');
    } catch (error: any) {
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const totalAddonProfit = addons.reduce((sum, a) => sum + (a.selling_price - a.cost_price), 0);
  const totalDealValue = (record.vehicle?.price || 0) + addons.reduce((sum, a) => sum + a.selling_price, 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border border-border rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Command Dropdown */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{record.customer_name}</h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {record.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{record.customer_email}</span>}
                  {record.customer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{record.customer_phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    Actions <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />View Finance Podium</DropdownMenuItem>
                  <DropdownMenuItem><Gavel className="w-4 h-4 mr-2" />Generate OTP</DropdownMenuItem>
                  <DropdownMenuItem><Package className="w-4 h-4 mr-2" />Move to Aftersales</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
            </div>
          </div>

          {/* Command Center Layout */}
          <div className="flex-1 grid grid-cols-3 divide-x divide-border overflow-hidden">
            {/* Left Panel - The Genome */}
            <div className="p-4 overflow-y-auto">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">THE GENOME</h3>
              {record.vehicle && (
                <div className="glass-card rounded-lg p-4 mb-4">
                  <h4 className="text-sm text-muted-foreground mb-2">Vehicle</h4>
                  <p className="font-semibold">{record.vehicle.year} {record.vehicle.make} {record.vehicle.model}</p>
                  <p className="text-muted-foreground text-sm">{record.vehicle.variant}</p>
                  <p className="text-primary font-medium mt-2">{formatPrice(record.vehicle.price)}</p>
                </div>
              )}
              <div className="glass-card rounded-lg p-4 mb-4">
                <h4 className="text-sm text-muted-foreground mb-2">Sale Date</h4>
                <p className="font-medium">{format(new Date(record.sale_date), 'dd MMMM yyyy')}</p>
              </div>
              <div className="glass-card rounded-lg p-4">
                <h4 className="text-sm text-muted-foreground mb-2">Notes</h4>
                <p className="text-sm">{record.notes || 'No notes'}</p>
              </div>
            </div>

            {/* Center Panel - Interaction History */}
            <div className="p-4 flex flex-col overflow-hidden">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">INTERACTION HISTORY</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                  {activities.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">No activity logged yet</p>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3 p-3 rounded-lg bg-secondary/30">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm">{activity.details || activity.action_type}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(activity.created_at), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Textarea placeholder="Add a note..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} className="flex-1" />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}><Send className="w-4 h-4" /></Button>
              </div>
            </div>

            {/* Right Panel - The Ledger */}
            <div className="p-4 flex flex-col overflow-hidden">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">THE LEDGER</h3>
              
              {/* Deal Add-ons */}
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-2 mb-4">
                  {addons.map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 group">
                      <div>
                        <p className="text-sm font-medium">{addon.name}</p>
                        <p className="text-xs text-muted-foreground">{addon.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-emerald-400">+{formatPrice(addon.selling_price - addon.cost_price)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteAddon.mutate({ id: addon.id, applicationId: record.finance_application_id! })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add Addon Form */}
                <div className="space-y-2 p-3 rounded-lg border border-dashed border-border">
                  <Input placeholder="Add-on name" value={addonName} onChange={(e) => setAddonName(e.target.value)} />
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Cost" value={addonCost} onChange={(e) => setAddonCost(e.target.value)} className="flex-1" />
                    <Input type="number" placeholder="Sell" value={addonSelling} onChange={(e) => setAddonSelling(e.target.value)} className="flex-1" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={addonCategory} onValueChange={setAddonCategory}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accessory">Accessory</SelectItem>
                        <SelectItem value="warranty">Warranty</SelectItem>
                        <SelectItem value="admin">Admin Fee</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddAddon} disabled={!addonName.trim()}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Add-on Profit</span><span className="text-emerald-400 font-medium">{formatPrice(totalAddonProfit)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total Deal Value</span><span className="text-primary">{formatPrice(totalDealValue)}</span></div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClientProfileModal;
