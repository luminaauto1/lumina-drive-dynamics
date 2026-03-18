import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Banknote, User, Car, Building2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import FinalizeDealModal from './FinalizeDealModal';

interface QuickCashDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (applicationId: string) => void;
}

const QuickCashDealModal = ({ open, onOpenChange, onCreated }: QuickCashDealModalProps) => {
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Workflow States
  const [showFinalize, setShowFinalize] = useState(false);
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);

  // Form States
  const [clientType, setClientType] = useState<'private' | 'trade'>('private');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Trade Network States
  const [tradePartners, setTradePartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  useEffect(() => {
    if (open) {
      const fetchPartners = async () => {
        const { data } = await supabase
          .from('trade_network')
          .select('*')
          .in('type', ['buyer', 'both'])
          .order('company_name');
        if (data) setTradePartners(data);
      };
      fetchPartners();
    }
  }, [open]);

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
    setClientType('private');
    setSelectedPartnerId('');
    setShowFinalize(false);
    setCreatedAppId(null);
  };

  const handleSubmit = async () => {
    let finalName = clientName;
    let finalPhone = clientPhone;
    let finalEmail = clientEmail;
    let finalBuyerType = 'cash';

    if (clientType === 'trade') {
      const partner = tradePartners.find(p => p.id === selectedPartnerId);
      if (!partner) {
        toast.error('Please select a trade partner');
        return;
      }
      finalName = partner.company_name;
      finalBuyerType = 'trade';
      if (partner.contact_persons && partner.contact_persons.length > 0) {
        finalPhone = partner.contact_persons[0].phone || '0000000000';
        finalEmail = 'trade@partner.com';
      } else {
        finalPhone = '0000000000';
        finalEmail = 'trade@partner.com';
      }
    } else {
      if (!clientName.trim() || !clientPhone.trim() || !clientEmail.trim()) {
        toast.error('Please fill in all private client fields');
        return;
      }
    }

    if (!selectedVehicleId) {
      toast.error('You must select a vehicle to run the Deal Calculator');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const nameParts = finalName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data, error } = await (supabase as any)
        .from('finance_applications')
        .insert({
          user_id: user.id,
          full_name: finalName.trim(),
          first_name: firstName,
          last_name: lastName,
          phone: finalPhone.trim(),
          email: finalEmail.trim(),
          status: 'vehicle_selected',
          internal_status: 'finance_approved',
          deal_type: 'cash',
          buyer_type: finalBuyerType,
          vehicle_id: selectedVehicleId || null,
        })
        .select()
        .single();

      if (error) throw error;

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

      setCreatedAppId(data.id);
      setShowFinalize(true);
    } catch (error: any) {
      console.error('Failed to create cash deal:', error);
      toast.error('Failed to create cash deal: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Intercept render to show F&I Modal
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  if (showFinalize && createdAppId && selectedVehicle) {
    return (
      <FinalizeDealModal
        isOpen={true}
        onClose={() => {
          resetForm();
          onOpenChange(false);
          onCreated(createdAppId);
        }}
        applicationId={createdAppId}
        vehicleId={selectedVehicle.id}
        vehiclePrice={selectedVehicle.price}
        vehicleMileage={selectedVehicle.mileage}
        vehicleStatus={selectedVehicle.status}
        vehicle={{
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          stock_number: selectedVehicle.stock_number,
          cost_price: selectedVehicle.cost_price,
          purchase_price: selectedVehicle.purchase_price,
          reconditioning_cost: selectedVehicle.reconditioning_cost,
        }}
        onSuccess={() => {
          toast.success('Cash deal structure saved!');
          resetForm();
          onOpenChange(false);
          onCreated(createdAppId);
        }}
        isCashDeal={true}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" />
            New Cash/Trade Deal
          </DialogTitle>
          <DialogDescription>
            Create the application and proceed to the Deal Calculator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Buyer Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <User className="w-4 h-4" />
                Buyer Information
              </div>
              <ToggleGroup
                type="single"
                value={clientType}
                onValueChange={(v) => v && setClientType(v as 'private' | 'trade')}
                size="sm"
                className="justify-end"
              >
                <ToggleGroupItem value="private" className="text-xs px-3">Private</ToggleGroupItem>
                <ToggleGroupItem value="trade" className="text-xs px-3">Trade</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {clientType === 'private' ? (
              <>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input placeholder="John Doe" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input placeholder="082 123 4567" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="john@example.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Select Trade Partner *</Label>
                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a trade buyer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tradePartners.length === 0 ? (
                      <SelectItem value="none" disabled>No trade buyers found</SelectItem>
                    ) : (
                      tradePartners.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedPartnerId && (
                  <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    <p className="font-medium">Auto-filled Details:</p>
                    <p>The deal will be registered under this company.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vehicle Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Car className="w-4 h-4" />
              Vehicle Selection *
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vehicles..." value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} className="pl-8" />
            </div>
            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-1 space-y-1">
                {filteredVehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${selectedVehicleId === v.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}
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
            disabled={isSubmitting || !selectedVehicleId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? 'Processing...' : 'Create & Calculate Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCashDealModal;
