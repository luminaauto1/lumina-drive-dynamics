// Motor-trade invoice tool (/admin/invoices).
//
// Two modes:
//  • Vehicle sale — the full motor-trade layout banks/dealers expect: Invoiced-To
//    + Delivered-on-your-behalf-to, USED VEHICLE DETAILS grid (VIN, engine no,
//    M&M code, KM…), Sold-For with Incl/VAT/Excl, misc items with per-line VAT
//    (Licence & Reg = VAT-exempt), Deposit / Trade-In / PRINCIPAL DEBT totals
//    and Conditions of Sale.
//  • General — the original simple description+amount invoice.
//
// Every generated invoice is SAVED (invoices table) with its full form state,
// so it can be re-downloaded or duplicated from the History list below the form.
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Car, Copy, Download, FileText, Pencil, Plus, Search, User, X, Building2, History } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVendors } from '@/hooks/useVendors';
import { useInvoices, useInsertInvoice, useUpdateInvoice, InvoiceRow } from '@/hooks/useInvoices';
import { useDocumentSettings, consumeInvoiceNumber, formatInvoiceNumber } from '@/hooks/useDocumentSettings';
import { computeInvoiceTotals } from '@/lib/generateDealInvoicePDF';
import { InvoicePrintPreview } from '@/features/invoice/InvoicePrintPreview';
import { ClientSearchInput, type ClientPick } from '@/components/admin/ClientSearchInput';
import { useVehiclesLite } from '@/hooks/useVehiclesLite';
import {
  InvoicePayload, EMPTY_PARTY,
  InvoiceParty as PartyState,
  InvoiceVehicle as VehicleState,
  InvoiceMisc as MiscItem,
  InvoiceGeneralLine as LineItem,
} from '@/features/invoice/types';

const fmtR = (n: number) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyVehicle = (): VehicleState => ({
  make: '', model: '', variant: '', year: '', yearFirstReg: '', colour: '', km: '',
  mmCode: '', vin: '', engineNo: '', regNo: '', stockNo: '', features: '',
  dateSold: format(new Date(), 'yyyy-MM-dd'), salesperson: '',
});

const MISC_PRESETS: { label: string; vatExempt: boolean }[] = [
  { label: 'Licence & Registration', vatExempt: true },
  { label: 'Delivery Fee', vatExempt: false },
  { label: 'DIC', vatExempt: false },
  { label: 'VAP', vatExempt: false },
  { label: 'Extras', vatExempt: false },
];

/** Map a picked client onto a party block — single mapping for Invoiced-To AND Delivered-To. */
const clientToParty = (c: ClientPick): PartyState => ({
  ...EMPTY_PARTY,
  name: c.name,
  regOrId: c.idNumber ? `ID: ${c.idNumber}` : '',
  address: c.address,
  postalCode: c.postalCode,
  email: c.email,
  phone: c.phone,
});

// Lightweight stock list — shared with the OTP Generator (hooks/useVehiclesLite).

const AdminInvoiceCreator = () => {
  const { data: vendors = [] } = useVendors();
  const { data: vehicles = [] } = useVehiclesLite();
  const { data: docSettings } = useDocumentSettings();
  const { data: history = [] } = useInvoices();
  const insertInvoice = useInsertInvoice();
  const updateInvoice = useUpdateInvoice();
  // Editing an existing invoice (owner 2026-07-17): loaded from History via the
  // pencil — Save UPDATES the row in place, keeping its invoice number.
  const [editing, setEditing] = useState<{ id: string; number: string } | null>(null);
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'vehicle' | 'general'>('vehicle');
  const [billTo, setBillTo] = useState<PartyState>({ ...EMPTY_PARTY });
  const [deliveredToEnabled, setDeliveredToEnabled] = useState(false);
  const [deliveredTo, setDeliveredTo] = useState<PartyState>({ ...EMPTY_PARTY });
  const [vehicle, setVehicle] = useState<VehicleState>(emptyVehicle());
  const [soldForIncl, setSoldForIncl] = useState(0);
  const [miscItems, setMiscItems] = useState<MiscItem[]>([]);
  const [depositPaid, setDepositPaid] = useState(0);
  const [tradeInDeposit, setTradeInDeposit] = useState(0);
  const [generalItems, setGeneralItems] = useState<LineItem[]>([{ description: '', amount: 0 }]);
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [taxInvoice, setTaxInvoice] = useState(false);
  const [busy, setBusy] = useState(false);
  // Full-screen document preview (obsidian A4, same family as Quote/OTP) —
  // "Download PDF" inside it prints the isolated document.
  const [preview, setPreview] = useState<InvoicePayload | null>(null);

  // Auto number preview — regenerating with this untouched consumes the counter.
  const autoNumber = docSettings ? formatInvoiceNumber(docSettings) : '';
  useEffect(() => {
    if (docSettings && !invoiceNumber) setInvoiceNumber(formatInvoiceNumber(docSettings));
  }, [docSettings, invoiceNumber]);
  useEffect(() => { if (docSettings?.vatRegistered) setTaxInvoice(true); }, [docSettings]);
  useEffect(() => {
    if (docSettings && !vehicle.salesperson) {
      setVehicle((v) => ({ ...v, salesperson: docSettings.otpSalesExecutive || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docSettings]);

  const vatRate = docSettings?.vatRegistered ? (docSettings.vatPercent || 0) : 0;

  // Live totals — computed by the SAME helper the PDF renderer uses, so the
  // screen, the saved grand_total and the printed document can never diverge.
  const totals = useMemo(() => {
    if (mode === 'general') {
      const t = computeInvoiceTotals(
        { soldForIncl: undefined, miscItems: generalItems.map((l) => ({ description: l.description, amountIncl: Number(l.amount) || 0 })) },
        vatRate,
      );
      return { grand: t.grandIncl, vat: t.totalVat, excl: t.subtotalExcl, principal: t.grandIncl, misc: 0, vehExcl: 0 };
    }
    const t = computeInvoiceTotals(
      {
        soldForIncl: Number(soldForIncl) || 0,
        miscItems: miscItems.map((m) => ({ description: m.description, amountIncl: Number(m.amountIncl) || 0, vatExempt: m.vatExempt })),
        depositPaid: Number(depositPaid) || 0,
        tradeInDeposit: Number(tradeInDeposit) || 0,
      },
      vatRate,
    );
    return { grand: t.grandIncl, vat: t.totalVat, excl: t.subtotalExcl, misc: t.miscExcl, vehExcl: t.vehExcl, principal: t.principal };
  }, [mode, generalItems, soldForIncl, miscItems, depositPaid, tradeInDeposit, vatRate]);

  const prefillFromVendor = (vendorId: string) => {
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setBillTo({
      ...EMPTY_PARTY,
      name: v.name || '',
      regOrId: v.registration_number ? `Reg: ${v.registration_number}` : '',
      vatNumber: v.vat_number || '',
      address: v.address || '',
      email: v.email || '',
      phone: v.phone || '',
    });
    if (v.is_vat_registered || docSettings?.vatRegistered) setTaxInvoice(true);
  };

  const prefillFromStock = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    setVehicle((prev) => ({
      ...prev,
      make: v.make || '',
      model: v.model || '',
      variant: v.variant || '',
      year: v.year ? String(v.year) : '',
      colour: v.color || '',
      km: v.mileage != null ? String(v.mileage) : '',
      vin: v.vin || '',
      engineNo: v.engine_code || '',
      regNo: v.registration_number || '',
      stockNo: v.stock_number || '',
    }));
    if (!soldForIncl && v.price) setSoldForIncl(Number(v.price));
  };

  const currentPayload = (): InvoicePayload => ({
    v: 1,
    mode, invoiceNumber, paymentReference, dateStr, taxInvoice,
    billTo, deliveredToEnabled, deliveredTo, vehicle,
    soldForIncl: Number(soldForIncl) || 0,
    miscItems, depositPaid: Number(depositPaid) || 0, tradeInDeposit: Number(tradeInDeposit) || 0,
    generalItems, notes,
  });

  const loadPayload = (p: InvoicePayload, freshNumber: boolean) => {
    setMode(p.mode || 'vehicle');
    setBillTo({ ...EMPTY_PARTY, ...(p.billTo || {}) });
    setDeliveredToEnabled(!!p.deliveredToEnabled);
    setDeliveredTo({ ...EMPTY_PARTY, ...(p.deliveredTo || {}) });
    setVehicle({ ...emptyVehicle(), ...(p.vehicle || {}) });
    setSoldForIncl(Number(p.soldForIncl) || 0);
    setMiscItems(Array.isArray(p.miscItems) ? p.miscItems : []);
    setDepositPaid(Number(p.depositPaid) || 0);
    setTradeInDeposit(Number(p.tradeInDeposit) || 0);
    setGeneralItems(Array.isArray(p.generalItems) && p.generalItems.length ? p.generalItems : [{ description: '', amount: 0 }]);
    setNotes(p.notes || '');
    setPaymentReference(p.paymentReference || '');
    setDateStr(freshNumber ? format(new Date(), 'yyyy-MM-dd') : p.dateStr || format(new Date(), 'yyyy-MM-dd'));
    setTaxInvoice(!!p.taxInvoice);
    setInvoiceNumber(freshNumber ? (docSettings ? formatInvoiceNumber(docSettings) : '') : p.invoiceNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generate = async () => {
    if (!docSettings) { toast.error('Document settings not loaded yet'); return; }
    if (!billTo.name.trim()) { toast.error('Enter who the invoice is billed to'); return; }
    if (mode === 'vehicle' && !(Number(soldForIncl) || miscItems.some((m) => Number(m.amountIncl)))) {
      toast.error('Enter the vehicle sold-for amount (or at least one misc item)');
      return;
    }
    if (mode === 'general' && !generalItems.some((l) => l.description.trim() || Number(l.amount))) {
      toast.error('Add at least one line item');
      return;
    }
    setBusy(true);
    let finalNumber = invoiceNumber.trim();
    try {
      // EDIT MODE — update the existing row in place; the invoice number is
      // preserved (never re-consumes the counter).
      if (editing) {
        finalNumber = finalNumber || editing.number;
        const payload = { ...currentPayload(), invoiceNumber: finalNumber };
        await updateInvoice.mutateAsync({
          id: editing.id,
          invoice_number: finalNumber,
          invoice_date: dateStr,
          kind: mode,
          bill_to_name: billTo.name.trim(),
          grand_total: totals.grand,
          payload: payload as any,
        });
        setPreview(payload);
        setEditing(null);
        setInvoiceNumber(''); // back to the next auto number for new invoices
        toast.success(`Invoice ${finalNumber} updated`);
        return;
      }

      // Untouched auto number → consume (and bump) the shared counter now.
      if (!finalNumber || finalNumber === autoNumber) {
        finalNumber = await consumeInvoiceNumber(docSettings);
        // The counter moved in the DB — refresh the cached settings so the next
        // auto number previews (and consumes) correctly without a page reload.
        queryClient.invalidateQueries({ queryKey: ['document-settings'] });
      }
      const payload = { ...currentPayload(), invoiceNumber: finalNumber };
      // Save FIRST, then open the document — if the save fails the operator is
      // told before a numbered document leaves the building.
      await insertInvoice.mutateAsync({
        invoice_number: finalNumber,
        invoice_date: dateStr,
        kind: mode,
        bill_to_name: billTo.name.trim(),
        grand_total: totals.grand,
        payload: payload as any,
      });
      setPreview(payload); // full-screen A4 preview → direct PDF download inside
      setInvoiceNumber(''); // re-defaults to the (now bumped) next number
      toast.success(`Invoice ${finalNumber} saved`);
    } catch (e: any) {
      // Pin the already-consumed number in the field so a retry reuses it (no gaps).
      if (finalNumber && !editing) setInvoiceNumber(finalNumber);
      toast.error(`Failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (row: InvoiceRow) => {
    loadPayload(row.payload as InvoicePayload, false);
    setEditing({ id: row.id, number: row.invoice_number });
    toast.info(`Editing invoice ${row.invoice_number} — Save will update it in place.`);
  };

  const redownload = (row: InvoiceRow) => {
    if (!docSettings) { toast.error('Document settings not loaded yet'); return; }
    setPreview(row.payload as InvoicePayload);
  };

  const setMisc = (i: number, patch: Partial<MiscItem>) =>
    setMiscItems((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const setGeneral = (i: number, patch: Partial<LineItem>) =>
    setGeneralItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const vehicleField = (label: string, key: keyof VehicleState, props: any = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={vehicle[key]} onChange={(e) => setVehicle((v) => ({ ...v, [key]: e.target.value }))} {...props} />
    </div>
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Invoice Creator
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Motor-trade vehicle invoices (VIN, engine no, per-line VAT, principal debt) or simple general invoices.
              Company &amp; banking details come from Document Settings.
            </p>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['vehicle', 'general'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {m === 'vehicle' ? 'Vehicle sale' : 'General'}
              </button>
            ))}
          </div>
        </div>

        {/* Invoiced To */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Invoiced To</CardTitle>
            <CardDescription>Prefill from a vendor (finance house / dealer) or search a client — everything stays editable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prefill from vendor</Label>
                <Select onValueChange={prefillFromVendor}>
                  <SelectTrigger><SelectValue placeholder="Select a vendor…" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <ClientSearch label="…or prefill from a client" onPick={(c) => setBillTo(clientToParty(c))} />
            </div>
            <PartyFields party={billTo} onChange={setBillTo} required showVat />
          </CardContent>
        </Card>

        {/* Delivered on your behalf to */}
        {mode === 'vehicle' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Delivered On Your Behalf To</CardTitle>
                <CardDescription>The end client, when the invoice is billed to a finance house / dealer.</CardDescription>
              </div>
              <Switch checked={deliveredToEnabled} onCheckedChange={setDeliveredToEnabled} />
            </CardHeader>
            {deliveredToEnabled && (
              <CardContent className="space-y-4">
                <ClientSearch label="Prefill from a client" onPick={(c) => setDeliveredTo(clientToParty(c))} />
                <PartyFields party={deliveredTo} onChange={setDeliveredTo} showWorkPhone />
              </CardContent>
            )}
          </Card>
        )}

        {/* Vehicle details */}
        {mode === 'vehicle' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Car className="w-4 h-4" /> Vehicle Details</CardTitle>
              <CardDescription>Pick from stock to autofill, or type everything manually (client-sourced cars).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prefill from stock</Label>
                <Select onValueChange={prefillFromStock}>
                  <SelectTrigger><SelectValue placeholder="Select a vehicle…" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.stock_number ? `#${v.stock_number}` : null, v.year, v.make, v.model, v.variant].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {vehicleField('Make', 'make')}
                {vehicleField('Model', 'model')}
                {vehicleField('Variant', 'variant')}
                {vehicleField('Year', 'year')}
                {vehicleField('Yr of 1st reg', 'yearFirstReg', { placeholder: 'Defaults to year' })}
                {vehicleField('Colour', 'colour')}
                {vehicleField('KM', 'km', { type: 'number' })}
                {vehicleField('M&M code', 'mmCode')}
                {vehicleField('VIN / Chassis no', 'vin')}
                {vehicleField('Engine no', 'engineNo')}
                {vehicleField('Reg no', 'regNo')}
                {vehicleField('Stock no', 'stockNo')}
                {vehicleField('Date sold', 'dateSold', { type: 'date' })}
                {vehicleField('Sales person', 'salesperson')}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Features (optional)</Label>
                <Input value={vehicle.features} onChange={(e) => setVehicle((v) => ({ ...v, features: e.target.value }))} placeholder="e.g. Tow bar, sunroof — or NONE" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <Label>Sold for (VAT incl.) <span className="text-red-400">*</span></Label>
                <Input
                  type="number" className="text-right font-semibold"
                  value={soldForIncl || ''}
                  onChange={(e) => setSoldForIncl(parseFloat(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Misc items (vehicle mode) */}
        {mode === 'vehicle' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Miscellaneous Items</CardTitle>
                <CardDescription>Per-line VAT — tick “No VAT” for exempt items like Licence &amp; Registration.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setMiscItems((p) => [...p, { description: '', amountIncl: 0, vatExempt: false }])}>
                <Plus className="w-4 h-4 mr-1" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {MISC_PRESETS.map((pz) => (
                  <Button
                    key={pz.label} type="button" variant="secondary" size="sm"
                    onClick={() => setMiscItems((p) => [...p, { description: pz.label, amountIncl: 0, vatExempt: pz.vatExempt }])}
                  >
                    + {pz.label}{pz.vatExempt ? ' (no VAT)' : ''}
                  </Button>
                ))}
              </div>
              {miscItems.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Description" value={m.description} onChange={(e) => setMisc(i, { description: e.target.value })} className="flex-1" />
                  <Input
                    type="number" placeholder="Amount (incl)" className="w-36 text-right"
                    value={m.amountIncl || ''}
                    onChange={(e) => setMisc(i, { amountIncl: parseFloat(e.target.value) || 0 })}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                    <Checkbox checked={m.vatExempt} onCheckedChange={(v) => setMisc(i, { vatExempt: v === true })} /> No VAT
                  </label>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setMiscItems((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 max-w-md pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Deposit paid</Label>
                  <Input type="number" className="text-right" value={depositPaid || ''} onChange={(e) => setDepositPaid(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Trade-in deposit</Label>
                  <Input type="number" className="text-right" value={tradeInDeposit || ''} onChange={(e) => setTradeInDeposit(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* General line items */}
        {mode === 'general' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setGeneralItems((p) => [...p, { description: '', amount: 0 }])}>
                <Plus className="w-4 h-4 mr-1" /> Add line
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {generalItems.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Description" value={l.description} onChange={(e) => setGeneral(i, { description: e.target.value })} className="flex-1" />
                  <Input
                    type="number" placeholder="Amount" className="w-36 text-right"
                    value={l.amount || ''}
                    onChange={(e) => setGeneral(i, { amount: parseFloat(e.target.value) || 0 })}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setGeneralItems((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Invoice meta + totals */}
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Details &amp; Totals</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Invoice number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder={autoNumber || 'INV-01001'} />
                {invoiceNumber === autoNumber && <p className="text-[11px] text-muted-foreground">Auto — the counter bumps when you generate.</p>}
              </div>
              <div className="space-y-2">
                <Label>Payment reference</Label>
                <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Defaults to invoice number" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <Switch id="inv-tax" checked={taxInvoice} onCheckedChange={setTaxInvoice} className="mt-0.5" />
              <Label htmlFor="inv-tax" className="cursor-pointer">
                Issue as a VAT invoice
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Titles it <strong>TAX INVOICE</strong> with VAT columns.
                  {docSettings?.vatRegistered
                    ? ` VAT at ${docSettings?.vatPercent || 0}%.`
                    : ' Zero-rated (VAT 0% — R0,00) while your company isn’t VAT-registered.'}
                </span>
              </Label>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5 text-sm">
              {mode === 'vehicle' && (
                <>
                  <TotalRow label="Miscellaneous items total (excl)" value={totals.misc} />
                  <TotalRow label="Vehicle (excl)" value={totals.vehExcl} />
                </>
              )}
              <TotalRow label="Subtotal (excl)" value={totals.excl} />
              <TotalRow label={`VAT @ ${vatRate}%`} value={totals.vat} />
              <TotalRow label="Grand total" value={totals.grand} bold />
              {mode === 'vehicle' && (
                <>
                  <TotalRow label="Deposit paid" value={Number(depositPaid) || 0} />
                  <TotalRow label="Trade-in deposit" value={Number(tradeInDeposit) || 0} />
                  <TotalRow label="PRINCIPAL DEBT" value={totals.principal} bold gold />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes (optional)</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to print under the totals…" />
          </CardContent>
        </Card>

        <div className="flex justify-end items-center gap-3">
          {editing && (
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Pencil className="w-4 h-4" />
              <span>Editing <span className="font-mono">{editing.number}</span> — Save updates it in place</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => { setEditing(null); setInvoiceNumber(''); toast.info('Switched to creating a new invoice.'); }}
              >
                Cancel
              </Button>
            </div>
          )}
          <Button onClick={generate} size="lg" disabled={busy}>
            <Download className="w-4 h-4 mr-2" /> {busy ? 'Saving…' : editing ? 'Update & Open Invoice' : 'Save & Open Invoice'}
          </Button>
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Invoice History</CardTitle>
            <CardDescription>Every generated invoice — re-download the exact PDF or duplicate it as a new draft.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet — the first one you generate lands here.</p>
            ) : (
              <div className="divide-y divide-border">
                {history.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="font-mono font-medium w-28 shrink-0">{row.invoice_number}</span>
                    <span className="text-muted-foreground w-24 shrink-0">{row.invoice_date ? format(new Date(row.invoice_date), 'dd MMM yyyy') : '—'}</span>
                    <span className="flex-1 truncate">{row.bill_to_name}</span>
                    <span className="tabular-nums font-medium">{fmtR(Number(row.grand_total) || 0)}</span>
                    <Button variant="ghost" size="icon" title="Download again" onClick={() => redownload(row)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit this invoice (updates it in place, same number)" onClick={() => startEditing(row)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Duplicate as new" onClick={() => { setEditing(null); loadPayload(row.payload as InvoicePayload, true); }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {preview && docSettings && (
        <InvoicePrintPreview payload={preview} settings={docSettings} onClose={() => setPreview(null)} />
      )}
    </AdminLayout>
  );
};

// ── Party fields grid ──
const PartyFields = ({ party, onChange, required, showVat, showWorkPhone }: {
  party: PartyState;
  onChange: (p: PartyState) => void;
  required?: boolean;
  showVat?: boolean;
  showWorkPhone?: boolean;
}) => {
  const set = (key: keyof PartyState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...party, [key]: e.target.value });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2 md:col-span-2">
        <Label>Name {required && <span className="text-red-400">*</span>}</Label>
        <Input value={party.name} onChange={set('name')} placeholder="Company or person" />
      </div>
      <div className="space-y-2"><Label>Reg / ID number</Label><Input value={party.regOrId} onChange={set('regOrId')} placeholder="Reg: 2008/… or ID: 8406…" /></div>
      {showVat && <div className="space-y-2"><Label>VAT number</Label><Input value={party.vatNumber} onChange={set('vatNumber')} /></div>}
      <div className="space-y-2"><Label>Email</Label><Input value={party.email} onChange={set('email')} /></div>
      {showWorkPhone && <div className="space-y-2"><Label>Tel (W)</Label><Input value={party.phoneWork} onChange={set('phoneWork')} /></div>}
      <div className="space-y-2"><Label>{showWorkPhone ? 'Tel (C)' : 'Phone'}</Label><Input value={party.phone} onChange={set('phone')} /></div>
      <div className="space-y-2"><Label>Postal code</Label><Input value={party.postalCode} onChange={set('postalCode')} /></div>
      <div className="space-y-2 md:col-span-2">
        <Label>Address</Label>
        <Textarea rows={2} value={party.address} onChange={set('address')} />
      </div>
    </div>
  );
};

// Client search lives in the shared ClientSearchInput component
// (also used by the OTP Generator).
const ClientSearch = ClientSearchInput;

const TotalRow = ({ label, value, bold, gold }: { label: string; value: number; bold?: boolean; gold?: boolean }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${gold ? 'text-primary' : ''}`}>
    <span>{label}</span>
    <span className="tabular-nums">{fmtR(value)}</span>
  </div>
);

export default AdminInvoiceCreator;
