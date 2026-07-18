import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Save } from 'lucide-react';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { toast } from 'sonner';
import { blankOtp } from '@/features/otp/blank';
import { OtpDocument } from '@/features/otp/OtpDocument';
import type { OtpData } from '@/features/otp/types';
import { downloadPdfFromPages, pdfFilename } from '@/lib/domToPdf';

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
  const [mmCode, setMmCode] = useState('');
  const [trim, setTrim] = useState('');
  const [stockNo, setStockNo] = useState('');
  const [orderType, setOrderType] = useState<'Used' | 'New' | 'Demo'>('Used');

  // Financial
  const [basePrice, setBasePrice] = useState<number>(0);
  // Extras are LINE ITEMS (owner 2026-07-17); extrasPrice = their sum.
  const [extrasItems, setExtrasItems] = useState<Array<{ description: string; amount: number }>>([]);
  const extrasPrice = extrasItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
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
    mmCode, trim, stockNo, orderType,
    basePrice, extrasPrice, extrasItems, vapPrice, adminFee, deliveryFee, licReg, deposit,
  });

  const applyDraft = (d: Partial<ReturnType<typeof collectDraft>>) => {
    setClientName(d.clientName ?? ''); setIdNumber(d.idNumber ?? ''); setAddress(d.address ?? '');
    setEmail(d.email ?? ''); setCellPhone(d.cellPhone ?? ''); setSalesExecutive(d.salesExecutive ?? 'Albert Prinsloo');
    setSignedPlace(d.signedPlace ?? 'Lumina Auto, Pretoria');
    setMake(d.make ?? ''); setModel(d.model ?? ''); setRegNo(d.regNo ?? ''); setYear(d.year ?? '');
    setColorVal(d.colorVal ?? ''); setVin(d.vin ?? ''); setEngineNo(d.engineNo ?? ''); setMileage(d.mileage ?? '');
    setMmCode((d as any).mmCode ?? ''); setTrim((d as any).trim ?? ''); setStockNo((d as any).stockNo ?? '');
    setOrderType(((d as any).orderType as 'Used' | 'New' | 'Demo') ?? 'Used');
    setBasePrice(d.basePrice ?? 0);
    // Old drafts carry a single extrasPrice number — surface it as one item.
    setExtrasItems(Array.isArray(d.extrasItems) && d.extrasItems.length
      ? d.extrasItems
      : (d.extrasPrice ? [{ description: 'Extras', amount: d.extrasPrice }] : []));
    setVapPrice(d.vapPrice ?? 0);
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
      setStockNo(vehicleData.stockNumber || '');
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

  // The popup now downloads the SAME designed 5-sheet legal document as the
  // OTP Generator page (owner 2026-07-17: the old text-PDF put signature blocks
  // wherever the flow landed — 11 loose pages). We build a full OtpData from
  // the modal fields, render the OtpDocument off-screen, and save each A4 sheet
  // as one PDF page — signature blocks exactly where the template puts them.
  const [pdfData, setPdfData] = useState<OtpData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!docSettings) { toast.error('Document settings not loaded yet'); return; }
    // Persist the latest values too, so a generated OTP can be reopened with the same data.
    try { localStorage.setItem(draftKey, JSON.stringify(collectDraft())); } catch { /* ignore */ }

    const base = blankOtp(docSettings);
    const cleanExtras = extrasItems.filter((i) => i.description.trim() || Number(i.amount));
    const data: OtpData = {
      ...base,
      offer: { ...base.offer, ref: quoteRef },
      client: { ...base.client, name: clientName, id: idNumber, address, email, cell: cellPhone },
      sales: { ...base.sales, exec_name: salesExecutive || base.sales.exec_name },
      vehicle: {
        ...base.vehicle,
        make, model, year, reg_no: regNo, colour: colorVal,
        vin, engine_no: engineNo, mileage,
        mm_code: mmCode, trim, stock_no: stockNo, order_type: orderType,
      },
      financials: {
        ...base.financials,
        base_price: basePrice,
        extras: extrasPrice,
        extras_items: cleanExtras.length ? cleanExtras : undefined,
        vap: vapPrice,
        admin_fee: adminFee,
        delivery_fee: deliveryFee,
        licensing: licReg,
        deposit,
      },
    };

    setDownloading(true);
    setPdfData(data);
    try {
      // Let React mount the off-screen document and fonts settle before capture.
      await new Promise((r) => setTimeout(r, 150));
      await (document as any).fonts?.ready?.catch?.(() => {});
      const root = pdfRef.current;
      if (!root) throw new Error('document did not render');
      const pages = Array.from(root.querySelectorAll<HTMLElement>('.page'));
      await downloadPdfFromPages(pages.length ? pages : [root], pdfFilename('OTP', quoteRef, clientName || 'client'));
      toast.success('OTP PDF downloaded');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('PDF download failed: ' + (e?.message || e));
    } finally {
      setDownloading(false);
      setPdfData(null);
    }
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
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">M&amp;M Code</Label><Input value={mmCode} onChange={e=>setMmCode(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Trim</Label><Input value={trim} onChange={e=>setTrim(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Stock No</Label><Input value={stockNo} onChange={e=>setStockNo(e.target.value)} className="bg-background border-input"/></div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Order Type</Label>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as 'Used' | 'New' | 'Demo')}>
                    <SelectTrigger className="bg-background border-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Used">Used</SelectItem>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Demo">Demo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Financial */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-amber-400 mb-3">3. Pricing (VAT-inclusive inputs)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Base Vehicle Price</Label><Input type="number" value={basePrice} onChange={e=>setBasePrice(parseFloat(e.target.value)||0)} className="bg-background border-input"/></div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">Extras (line items — each prints on the OTP)</Label>
                  {extrasItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={it.description}
                        placeholder="e.g. Tow bar"
                        onChange={(e) => setExtrasItems((prev) => prev.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                        className="bg-background border-input flex-1"
                      />
                      <Input
                        type="number"
                        value={it.amount || ''}
                        placeholder="0.00"
                        onChange={(e) => setExtrasItems((prev) => prev.map((x, idx) => idx === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                        className="bg-background border-input w-36"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
                        onClick={() => setExtrasItems((prev) => prev.filter((_, idx) => idx !== i))} title="Remove extra">
                        ✕
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="outline" size="sm" className="h-7"
                      onClick={() => setExtrasItems((prev) => [...prev, { description: '', amount: 0 }])}>
                      + Add extra
                    </Button>
                    {extrasItems.length > 0 && (
                      <span className="text-xs text-muted-foreground">Extras total: <span className="font-mono text-foreground">{fmt(extrasPrice)}</span></span>
                    )}
                  </div>
                </div>
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
          <Button onClick={handleDownload} disabled={downloading} className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
            <Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download OTP PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* Off-screen render of the designed 5-sheet OTP document for the PDF
          capture — signature blocks land exactly where the template puts them. */}
      {pdfData && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm', zIndex: -1 }} aria-hidden>
          <div ref={pdfRef}>
            <OtpDocument data={pdfData} />
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default OTPModal;
