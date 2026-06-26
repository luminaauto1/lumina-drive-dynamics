import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText } from 'lucide-react';
import { generateOTP, OTPData } from '@/lib/generateOTP';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { toast } from 'sonner';

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

const OTPModal = ({ open, onOpenChange, applicationData, vehicleData }: OTPModalProps) => {
  // Contact
  const [clientName, setClientName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [salesExecutive, setSalesExecutive] = useState('Albert Prinsloo');
  const [signedPlace, setSignedPlace] = useState('Lumina Auto, Pretoria');

  // Vehicle
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [regNo, setRegNo] = useState('');
  const [year, setYear] = useState('');
  const [colorVal, setColorVal] = useState('');
  const [vin, setVin] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [mileage, setMileage] = useState('');

  // Financial
  const [basePrice, setBasePrice] = useState<number>(0);
  const [extrasPrice, setExtrasPrice] = useState<number>(0);
  const [vapPrice, setVapPrice] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(2500);
  const [deposit, setDeposit] = useState<number>(0);

  const quoteRef = `OTP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
  const today = new Date().toLocaleDateString('en-ZA');

  // Pull customizable company defaults (admin fee, signing place) from settings.
  const { data: docSettings } = useDocumentSettings();
  useEffect(() => {
    if (docSettings) {
      setAdminFee(docSettings.defaultAdminFee ?? 2500);
      if (docSettings.companyTradingName) {
        setSignedPlace(`${docSettings.companyTradingName}${docSettings.companyAddress ? `, ${docSettings.companyAddress}` : ''}`);
      }
    }
  }, [docSettings]);

  useEffect(() => {
    if (applicationData) {
      setClientName(applicationData.clientName || '');
      setIdNumber(applicationData.idNumber || '');
      setAddress(applicationData.address || '');
      setEmail(applicationData.email || '');
      setCellPhone(applicationData.phone || '');
    }
    if (vehicleData) {
      setMake(vehicleData.make || '');
      setModel([vehicleData.model, vehicleData.variant].filter(Boolean).join(' '));
      setYear(vehicleData.year?.toString() || '');
      setVin(vehicleData.vin || '');
      setEngineNo(vehicleData.engineCode || '');
      setMileage(vehicleData.mileage ? `${vehicleData.mileage.toLocaleString()} km` : '');
      setColorVal(vehicleData.color || '');
      setBasePrice(vehicleData.price || 0);
    }
  }, [applicationData, vehicleData, open]);

  // All entered amounts are VAT-inclusive
  const totalPrice = basePrice + extrasPrice + vapPrice + adminFee;
  const vatAmount = totalPrice * (15 / 115);
  const vatableSubtotal = totalPrice - vatAmount;
  const balancePayable = totalPrice - deposit;

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDownload = () => {
    const data: OTPData = {
      clientName: clientName || '[PENDING]',
      idNumber: idNumber || '[PENDING]',
      address: address || '[PENDING]',
      email: email || '[PENDING]',
      cellPhone: cellPhone || '[PENDING]',
      salesExecutive: salesExecutive || 'Albert Prinsloo',
      date: today,
      quoteRef,
      make: make || '[PENDING]',
      model: model || '[PENDING]',
      year: year || '[PENDING]',
      regNo: regNo || '[TBA]',
      colorVal: colorVal || '[TBA]',
      vin: vin || '[PENDING]',
      engineNo: engineNo || '[TBA]',
      mileage: mileage || '[PENDING]',
      basePrice,
      extrasPrice,
      vapPrice,
      adminFee,
      deposit,
      signedPlace,
      companyLegalName: docSettings?.companyLegalName,
      companyTradingName: docSettings?.companyTradingName,
      companyContactLine: docSettings
        ? [docSettings.companyAddress, docSettings.companyEmail, docSettings.companyPhone].filter(Boolean).join('  •  ')
        : undefined,
    };
    generateOTP(data);
    toast.success('OTP PDF downloaded');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <FileText className="w-5 h-5 text-amber-400" />
            Configure Offer to Purchase
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Confirm vehicle & pricing details before generating the legal OTP.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Client */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">1. Client</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Client Name</Label><Input value={clientName} onChange={e=>setClientName(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">ID Number</Label><Input value={idNumber} onChange={e=>setIdNumber(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5 col-span-2"><Label className="text-xs text-zinc-400">Address</Label><Input value={address} onChange={e=>setAddress(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Email</Label><Input value={email} onChange={e=>setEmail(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Cell Phone</Label><Input value={cellPhone} onChange={e=>setCellPhone(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Sales Executive</Label><Input value={salesExecutive} onChange={e=>setSalesExecutive(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5 col-span-2"><Label className="text-xs text-zinc-400">Place of Signing / Delivery</Label><Input value={signedPlace} onChange={e=>setSignedPlace(e.target.value)} placeholder="e.g. Client home – 12 Oak Ave, Sandton" className="bg-zinc-900 border-zinc-800"/></div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Vehicle */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">2. Vehicle</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Make</Label><Input value={make} onChange={e=>setMake(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Model</Label><Input value={model} onChange={e=>setModel(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Reg No</Label><Input value={regNo} onChange={e=>setRegNo(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Year</Label><Input value={year} onChange={e=>setYear(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Colour</Label><Input value={colorVal} onChange={e=>setColorVal(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">VIN No</Label><Input value={vin} onChange={e=>setVin(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Engine No</Label><Input value={engineNo} onChange={e=>setEngineNo(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Mileage</Label><Input value={mileage} onChange={e=>setMileage(e.target.value)} className="bg-zinc-900 border-zinc-800"/></div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Financial */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">3. Pricing (VAT-inclusive inputs)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Base Vehicle Price</Label><Input type="number" value={basePrice} onChange={e=>setBasePrice(parseFloat(e.target.value)||0)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Extras Price</Label><Input type="number" value={extrasPrice} onChange={e=>setExtrasPrice(parseFloat(e.target.value)||0)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Value Added Products Price</Label><Input type="number" value={vapPrice} onChange={e=>setVapPrice(parseFloat(e.target.value)||0)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Administration Fee</Label><Input type="number" value={adminFee} onChange={e=>setAdminFee(parseFloat(e.target.value)||0)} className="bg-zinc-900 border-zinc-800"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-400">Deposit</Label><Input type="number" value={deposit} onChange={e=>setDeposit(parseFloat(e.target.value)||0)} className="bg-zinc-900 border-zinc-800"/></div>
              </div>

              <div className="mt-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                <div className="flex justify-between text-sm text-zinc-400"><span>Subtotal (excl. VAT)</span><span className="font-mono text-zinc-200">{fmt(vatableSubtotal)}</span></div>
                <div className="flex justify-between text-sm text-zinc-400"><span>VAT (15%) included</span><span className="font-mono text-zinc-200">{fmt(vatAmount)}</span></div>
                <div className="flex justify-between text-sm text-zinc-400"><span>Total Price (incl. VAT)</span><span className="font-mono text-zinc-200">{fmt(totalPrice)}</span></div>
                <div className="flex justify-between text-sm text-zinc-400"><span>Less: Deposit</span><span className="font-mono text-zinc-200">- {fmt(deposit)}</span></div>
                <Separator className="bg-zinc-800 my-2"/>
                <div className="flex justify-between items-center"><span className="font-semibold text-zinc-100">Balance Payable (incl. VAT)</span><span className="text-xl font-bold text-amber-400 font-mono">{fmt(balancePayable)}</span></div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-900">Cancel</Button>
          <Button onClick={handleDownload} className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
            <Download className="w-4 h-4" /> Download OTP PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OTPModal;
