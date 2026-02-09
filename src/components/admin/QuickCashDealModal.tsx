import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Banknote, User, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface QuickCashDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (applicationId: string) => void;
}

const QuickCashDealModal = ({ open, onOpenChange, onCreated }: QuickCashDealModalProps) => {
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const selectableVehicles = vehicles.filter(v =>
    ['available', 'reserved', 'incoming', 'sourcing', 'hidden'].includes(v.status)
  );

  const filteredVehicles = vehicleSearch
    ? selectableVehicles.filter(v =>
        `${v.make} ${v.model} ${v.variant || ''} ${v.stock_number || ''}`.toLowerCase().includes(vehicleSearch.toLowerCase())
      )
    : selectableVehicles;

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setSelectedVehicleId('');
    setVehicleSearch('');
  };

  const handleSubmit = async () => {
    if (!clientName.trim() || !clientPhone.trim() || !clientEmail.trim()) {
      toast.error('Please fill in all client fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get admin user id for user_id field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const nameParts = clientName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data, error } = await (supabase as any)
        .from('finance_applications')
        .insert({
          user_id: user.id,
          full_name: clientName.trim(),
          first_name: firstName,
          last_name: lastName,
          phone: clientPhone.trim(),
          email: clientEmail.trim(),
          status: 'vehicle_selected',
          internal_status: 'finance_approved',
          deal_type: 'cash',
          buyer_type: 'cash',
          vehicle_id: selectedVehicleId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If vehicle selected, reserve it
      if (selectedVehicleId) {
        await supabase
          .from('vehicles')
          .update({
            reserved_for_application_id: data.id,
            status: 'reserved',
          })
          .eq('id', selectedVehicleId);
      }

      await queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });

      toast.success(`Cash deal created for ${clientName}`);
      resetForm();
      onOpenChange(false);
      onCreated(data.id);
    } catch (error: any) {
      console.error('Failed to create cash deal:', error);
      toast.error('Failed to create cash deal: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" />
            New Cash Deal
          </DialogTitle>
          <DialogDescription>
            Create a quick cash deal. This skips the finance pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <User className="w-4 h-4" />
              Client Information
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="John Doe"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                placeholder="082 123 4567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Vehicle Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Car className="w-4 h-4" />
              Vehicle (Optional)
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-1 space-y-1">
                <button
                  onClick={() => setSelectedVehicleId('')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    !selectedVehicleId ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                  }`}
                >
                  <p className="text-muted-foreground italic">No vehicle (Sourcing)</p>
                </button>
                {filteredVehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedVehicleId === v.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-sm">
                      {v.year} {v.make} {v.model} {v.variant || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(v.price)} • {v.stock_number || 'No Stock #'}
                      {v.status !== 'available' && (
                        <span className="ml-1 text-amber-400">({v.status})</span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !clientName.trim() || !clientPhone.trim() || !clientEmail.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? 'Creating...' : '➕ Create Cash Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCashDealModal;
