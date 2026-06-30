import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Save } from 'lucide-react';
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

const OTPModal = ({ open, onOpenChange, applicationData, vehicleData, dealId }: OTPModalProps) => {
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
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [licReg, setLicReg] = useState<number>(0);
  const [deposit, setDeposit] = useState<number>(0);

  const quoteRef = `OTP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
  const today = new Date().toLocaleDateString('en-ZA');

  // Persist the form so entered data survives closing/reopening (keyed per deal, else per client).
  const draftKey = `lumina:otp-draft:${dealId || applicationData?.idNumber || 'default'}`;

  const collectDraft = () => ({
    clientName, idNumber, address, email, cellPhone, salesExecutive, signedPlace,
    make, model, regNo, year, colorVal, vin, engineNo, mileage,
    basePrice, extrasPrice, vapPrice, adminFee, deliveryFee, licReg, deposit,
  });

  const applyDraft = (d: Partial<ReturnType<typeof collectDraft>>) => {
    setClientName(d.clientName ?? ''); setIdNumber(d.idNumber ?? ''); setAddress(d.address ?? '');
    setEmail(d.email ?? ''); setCellPhone(d.cellPhone ?? ''); setSalesExecutive(d.salesExecutive ?? 'Albert Prinsloo');
    setSignedPlace(d.signedPlace ?? 'Lumina Auto, Pretoria');
    setMake(d.make ?? ''); setModel(d.model ?? ''); setRegNo(d.regNo ?? ''); setYear(d.year ?? '');
    setColorVal(d.colorVal ?? ''); setVin(d.vin ?? ''); setEngineNo(d.engineNo ?? ''); setMileage(d.mileage ?? '');
    setBasePrice(d.basePrice ?? 0); setExtrasPrice(d.extrasPrice ?? 0); setVapPrice(d.vapPrice ?? 0);
    setAdminFee(d.adminFee ?? 2500); setDeliveryFee(d.deliveryFee ?? 0); setLicReg(d.licReg ?? 0); setDeposit(d.deposit ?? 0);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(collectDraft()));
      toast.success('Draft saved');
    } catch {
      toast.error('Could not save draft');
    }
  };

  // Pull customizable company defaults (admin fee, signing place) from settings.
  const { data: docSettings } = useDocumentSettings();
  useEffect(() => {
    if (!docSettings) return;
    // Don't override a saved draft with the company defaults.
    try { if (localStorage.getItem(draftKey)) return; } catch { /* ignore */ }
    setAdminFee(docSettings.defaultAdminFee ?? 2500);
    if (docSettings.companyTradingName) {
      setSignedPlace(`${docSettings.companyTradingName}${docSettings.companyAddress ? `, ${docSettings.companyAddress}` : ''}`);
    }
  }, [docSettings, draftKey]);

  useEffect(() => {
    if (!open) return;
    // Restore a saved draft if one exists, so entered data survives closing/reopening.
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) { applyDraft(JSON.parse(saved)); return; }
    } catch { /* ignore a corrupt draft */ }
    // Otherwise prefill from the deal / selected vehicle.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, applicationData, vehicleData, draftKey]);

  // Base, extras, VAP, admin fee and delivery fee are VAT-inclusive.
  // Lic & Reg is a non-VATable statutory disbursement (excluded from the VAT calc).
  const vatInclusiveTotal = basePrice + extrasPrice + vapPrice + adminFee + deliveryFee;
  const vatAmount = vatInclusiveTotal * (15 / 115);
  const vatableSubtotal = vatInclusiveTotal - vatAmount;
  const totalPrice = vatInclusiveTotal + licReg;
  const balancePayable = totalPrice - deposit;

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDownload = () => {
    // Persist the latest values too, so a generated OTP can be reopened with the same data.
    try { localStorage.setItem(draftKey, JSON.stringify(collectDraft())); } catch { /* ignore */ }
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
      deliveryFee,
      licReg,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-amber-400" />
            Configure Offer to Purchase
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Confirm vehicle & pricing details before generating the legal OTP.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Client */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">1. Client</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Client Name</Label><Input value={clientName} onChange={e=>setClientName(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">ID Number</Label><Input value={idNumber} onChange={e=>setIdNumber(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5 col-span-2"><Label className="text-xs text-muted-foreground">Address</Label><Input value={address} onChange={e=>setAddress(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Email</Label><Input value={email} onChange={e=>setEmail(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Cell Phone</Label><Input value={cellPhone} onChange={e=>setCellPhone(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Sales Executive</Label><Input value={salesExecutive} onChange={e=>setSalesExecutive(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5 col-span-2"><Label className="text-xs text-muted-foreground">Place of Signing / Delivery</Label><Input value={signedPlace} onChange={e=>setSignedPlace(e.target.value)} placeholder="e.g. Client home – 12 Oak Ave, Sandton" className="bg-background border-input"/></div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Vehicle */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">2. Vehicle</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Make</Label><Input value={make} onChange={e=>setMake(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Model</Label><Input value={model} onChange={e=>setModel(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Reg No</Label><Input value={regNo} onChange={e=>setRegNo(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Year</Label><Input value={year} onChange={e=>setYear(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Colour</Label><Input value={colorVal} onChange={e=>setColorVal(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">VIN No</Label><Input value={vin} onChange={e=>setVin(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Engine No</Label><Input value={engineNo} onChange={e=>setEngineNo(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Mileage</Label><Input value={mileage} onChange={e=>setMileage(e.target.value)} className="bg-background border-input"/></div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Financial */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">3. Pricing (VAT-inclusive inputs)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Base Vehicle Price</Label><Input type="number" value={basePrice} onChange={e=>setBasePrice(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Extras Price</Label><Input type="number" value={extrasPrice} onChange={e=>setExtrasPrice(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Value Added Products Price</Label><Input type="number" value={vapPrice} onChange={e=>setVapPrice(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Administration Fee</Label><Input type="number" value={adminFee} onChange={e=>setAdminFee(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Delivery Fee</Label><Input type="number" value={deliveryFee} onChange={e=>setDeliveryFee(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Lic &amp; Reg <span className="text-muted-foreground">(no VAT)</span></Label><Input type="number" value={licReg} onChange={e=>setLicReg(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Deposit</Label><Input type="number" value={deposit} onChange={e=>setDeposit(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
              </div>

              <div className="mt-4 p-4 bg-muted/60 border border-border rounded-lg space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal (excl. VAT)</span><span className="font-mono text-foreground">{fmt(vatableSubtotal)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>VAT (15%) included</span><span className="font-mono text-foreground">{fmt(vatAmount)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Lic &amp; Reg (no VAT)</span><span className="font-mono text-foreground">{fmt(licReg)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Total Price (incl. VAT)</span><span className="font-mono text-foreground">{fmt(totalPrice)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Less: Deposit</span><span className="font-mono text-foreground">- {fmt(deposit)}</span></div>
                <Separator className="bg-border my-2"/>
                <div className="flex justify-between items-center"><span className="font-semibold text-foreground">Balance Payable (incl. VAT)</span><span className="text-xl font-bold text-amber-400 font-mono">{fmt(balancePayable)}</span></div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={saveDraft} className="gap-2">
            <Save className="w-4 h-4" /> Save
          </Button>
          <Button onClick={handleDownload} className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
            <Download className="w-4 h-4" /> Download OTP PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OTPModal;
