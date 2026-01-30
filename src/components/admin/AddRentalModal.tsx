import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRentals, CreateRentalData } from '@/hooks/useRentals';
import { Car, User, Banknote } from 'lucide-react';

interface AddRentalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddRentalModal = ({ open, onOpenChange }: AddRentalModalProps) => {
  const { createRental } = useRentals();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CreateRentalData>({
    vehicle_make_model: '',
    registration_number: '',
    vin_number: '',
    purchase_price: 0,
    initial_recon_cost: 0,
    renter_name: '',
    renter_contact: '',
    renter_id_number: '',
    monthly_rent: 0,
    deposit_amount: 0,
    payment_day: 1,
    notes: '',
  });

  const handleChange = (field: keyof CreateRentalData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.vehicle_make_model || !formData.registration_number || !formData.monthly_rent) {
      return;
    }

    await createRental.mutateAsync(formData);
    onOpenChange(false);
    setStep(1);
    setFormData({
      vehicle_make_model: '',
      registration_number: '',
      vin_number: '',
      purchase_price: 0,
      initial_recon_cost: 0,
      renter_name: '',
      renter_contact: '',
      renter_id_number: '',
      monthly_rent: 0,
      deposit_amount: 0,
      payment_day: 1,
      notes: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Rental Vehicle</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                step >= s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-muted-foreground text-muted-foreground'
              }`}
            >
              {s === 1 && <Car className="w-5 h-5" />}
              {s === 2 && <User className="w-5 h-5" />}
              {s === 3 && <Banknote className="w-5 h-5" />}
            </div>
          ))}
        </div>

        {/* Step 1: Car Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Car Details</h3>
            <div className="space-y-3">
              <div>
                <Label>Make & Model *</Label>
                <Input
                  placeholder="e.g. Toyota Corolla Quest"
                  value={formData.vehicle_make_model}
                  onChange={(e) => handleChange('vehicle_make_model', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Registration *</Label>
                  <Input
                    placeholder="e.g. JD 77 GP"
                    value={formData.registration_number}
                    onChange={(e) => handleChange('registration_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label>VIN</Label>
                  <Input
                    placeholder="VIN Number"
                    value={formData.vin_number || ''}
                    onChange={(e) => handleChange('vin_number', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Purchase Price (R)</Label>
                  <Input
                    type="number"
                    value={formData.purchase_price || ''}
                    onChange={(e) => handleChange('purchase_price', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Initial Recon Cost (R)</Label>
                  <Input
                    type="number"
                    value={formData.initial_recon_cost || ''}
                    onChange={(e) => handleChange('initial_recon_cost', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!formData.vehicle_make_model || !formData.registration_number}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Renter Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Renter Details (Optional)</h3>
            <div className="space-y-3">
              <div>
                <Label>Renter Name</Label>
                <Input
                  placeholder="Full Name"
                  value={formData.renter_name || ''}
                  onChange={(e) => handleChange('renter_name', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact Number</Label>
                  <Input
                    placeholder="Phone"
                    value={formData.renter_contact || ''}
                    onChange={(e) => handleChange('renter_contact', e.target.value)}
                  />
                </div>
                <div>
                  <Label>ID Number</Label>
                  <Input
                    placeholder="ID Number"
                    value={formData.renter_id_number || ''}
                    onChange={(e) => handleChange('renter_id_number', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Financials */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Financial Details</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monthly Rent (R) *</Label>
                  <Input
                    type="number"
                    value={formData.monthly_rent || ''}
                    onChange={(e) => handleChange('monthly_rent', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Deposit (R)</Label>
                  <Input
                    type="number"
                    value={formData.deposit_amount || ''}
                    onChange={(e) => handleChange('deposit_amount', Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label>Payment Day (1-31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.payment_day || 1}
                  onChange={(e) => handleChange('payment_day', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!formData.monthly_rent || createRental.isPending}
              >
                {createRental.isPending ? 'Adding...' : 'Add Rental'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddRentalModal;
