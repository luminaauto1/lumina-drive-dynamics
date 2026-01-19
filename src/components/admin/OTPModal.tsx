import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Plus, Trash2, FileText } from 'lucide-react';
import { generateOTP, OTPData } from '@/lib/generateOTP';
import { toast } from 'sonner';

interface Extra {
  description: string;
  amount: number;
}

interface OTPModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationData?: {
    clientName?: string;
    idNumber?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  vehicleData?: {
    make?: string;
    model?: string;
    variant?: string;
    year?: number;
    vin?: string;
    engineCode?: string;
    mileage?: number;
    color?: string;
    price?: number;
    stockNumber?: string;
  };
  dealId?: string;
}

const OTPModal = ({ open, onOpenChange, applicationData, vehicleData, dealId }: OTPModalProps) => {
  // Contact Information
  const [clientName, setClientName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [salesExecutive, setSalesExecutive] = useState('Albert');
  const [signedPlace, setSignedPlace] = useState('Pretoria');
  
  // Vehicle Details
  const [makeModel, setMakeModel] = useState('');
  const [year, setYear] = useState('');
  const [regNo, setRegNo] = useState('');
  const [vin, setVin] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [mileage, setMileage] = useState('');
  const [color, setColor] = useState('');
  
  // Financial
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(2500);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [newExtraDesc, setNewExtraDesc] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState<number>(0);
  
  // Generate quote reference
  const quoteRef = `OTP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
  const today = new Date().toLocaleDateString('en-ZA');

  // Auto-fill from props
  useEffect(() => {
    if (applicationData) {
      setClientName(applicationData.clientName || '');
      setIdNumber(applicationData.idNumber || '');
      setAddress(applicationData.address || '');
      setEmail(applicationData.email || '');
      setCellPhone(applicationData.phone || '');
    }
    if (vehicleData) {
      const model = [vehicleData.make, vehicleData.model, vehicleData.variant].filter(Boolean).join(' ');
      setMakeModel(model);
      setYear(vehicleData.year?.toString() || '');
      setVin(vehicleData.vin || '');
      setEngineNo(vehicleData.engineCode || '');
      setMileage(vehicleData.mileage?.toLocaleString() + ' km' || '');
      setColor(vehicleData.color || '');
      setTotalPrice(vehicleData.price || 0);
    }
  }, [applicationData, vehicleData, open]);

  const addExtra = () => {
    if (!newExtraDesc.trim() || newExtraAmount <= 0) {
      toast.error('Please enter a valid extra description and amount');
      return;
    }
    setExtras([...extras, { description: newExtraDesc.trim(), amount: newExtraAmount }]);
    setNewExtraDesc('');
    setNewExtraAmount(0);
  };

  const removeExtra = (index: number) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const extrasTotal = extras.reduce((sum, e) => sum + e.amount, 0);
    return totalPrice + extrasTotal + adminFee;
  };

  const handleDownload = () => {
    const otpData: OTPData = {
      clientName: clientName || '[PENDING]',
      idNumber: idNumber || '[PENDING]',
      address: address || '[PENDING]',
      email: email || '[PENDING]',
      cellPhone: cellPhone || '[PENDING]',
      salesExecutive: salesExecutive || 'Albert',
      date: today,
      quoteRef,
      makeModel: makeModel || '[PENDING]',
      year: year || '[PENDING]',
      regNo: regNo || '[TBA]',
      vin: vin || '[PENDING]',
      engineNo: engineNo || '[TBA]',
      mileage: mileage || '[PENDING]',
      color: color || '[TBA]',
      totalPrice: calculateTotal(),
      extras,
      adminFee,
      signedPlace,
    };

    generateOTP(otpData);
    toast.success('OTP PDF downloaded successfully');
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Generate Offer to Purchase (OTP)
          </DialogTitle>
          <DialogDescription>
            Review and edit the details before generating the legal document.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Section 1: Contact Information */}
            <div>
              <h3 className="font-semibold text-sm text-primary mb-3">1. Contact Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Client Name *</Label>
                  <Input 
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)} 
                    placeholder="Full Name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Number *</Label>
                  <Input 
                    value={idNumber} 
                    onChange={(e) => setIdNumber(e.target.value)} 
                    placeholder="SA ID Number"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Input 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Street Address, City"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cell Phone</Label>
                  <Input 
                    value={cellPhone} 
                    onChange={(e) => setCellPhone(e.target.value)} 
                    placeholder="068 601 7462"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sales Executive</Label>
                  <Input 
                    value={salesExecutive} 
                    onChange={(e) => setSalesExecutive(e.target.value)} 
                    placeholder="Albert"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Signed at (Place)</Label>
                  <Input 
                    value={signedPlace} 
                    onChange={(e) => setSignedPlace(e.target.value)} 
                    placeholder="Pretoria"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 2: Vehicle Details */}
            <div>
              <h3 className="font-semibold text-sm text-primary mb-3">2. Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Make & Model</Label>
                  <Input 
                    value={makeModel} 
                    onChange={(e) => setMakeModel(e.target.value)} 
                    placeholder="VW Golf 8 GTI"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Year</Label>
                  <Input 
                    value={year} 
                    onChange={(e) => setYear(e.target.value)} 
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reg No.</Label>
                  <Input 
                    value={regNo} 
                    onChange={(e) => setRegNo(e.target.value)} 
                    placeholder="ABC 123 GP"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">VIN</Label>
                  <Input 
                    value={vin} 
                    onChange={(e) => setVin(e.target.value)} 
                    placeholder="Vehicle Identification Number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Engine No.</Label>
                  <Input 
                    value={engineNo} 
                    onChange={(e) => setEngineNo(e.target.value)} 
                    placeholder="Engine Number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mileage</Label>
                  <Input 
                    value={mileage} 
                    onChange={(e) => setMileage(e.target.value)} 
                    placeholder="45,000 km"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Color</Label>
                  <Input 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)} 
                    placeholder="Pure White"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3: Financial */}
            <div>
              <h3 className="font-semibold text-sm text-primary mb-3">3. Financial Summary</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vehicle Price (Incl. VAT)</Label>
                  <Input 
                    type="number"
                    value={totalPrice} 
                    onChange={(e) => setTotalPrice(parseFloat(e.target.value) || 0)} 
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Admin Fee</Label>
                  <Input 
                    type="number"
                    value={adminFee} 
                    onChange={(e) => setAdminFee(parseFloat(e.target.value) || 0)} 
                    placeholder="2500"
                  />
                </div>
              </div>

              {/* Extras */}
              <div className="space-y-3">
                <Label className="text-xs font-medium">Extras / Value Added Products</Label>
                
                {extras.length > 0 && (
                  <div className="space-y-2">
                    {extras.map((extra, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <span className="text-sm">{extra.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatCurrency(extra.amount)}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeExtra(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g., Smash & Grab"
                    value={newExtraDesc}
                    onChange={(e) => setNewExtraDesc(e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    type="number"
                    placeholder="Amount"
                    value={newExtraAmount || ''}
                    onChange={(e) => setNewExtraAmount(parseFloat(e.target.value) || 0)}
                    className="w-28"
                  />
                  <Button variant="outline" size="icon" onClick={addExtra}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Total Summary */}
              <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">TOTAL (Incl. VAT)</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download OTP PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OTPModal;
