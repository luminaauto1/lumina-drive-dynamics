import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Plus, X, Download, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useVendors } from '@/hooks/useVendors';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { generateDealInvoicePDF, DealInvoiceData } from '@/lib/generateDealInvoicePDF';

const fmtR = (n: number) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface LineItem { description: string; amount: number }

const AdminInvoiceCreator = () => {
  const { data: vendors = [] } = useVendors();
  const { data: docSettings } = useDocumentSettings();

  // Bill-to (editable; can be prefilled from a vendor)
  const [name, setName] = useState('');
  const [regOrId, setRegOrId] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', amount: 0 }]);
  const [notes, setNotes] = useState('');
  const [taxInvoice, setTaxInvoice] = useState(false); // issue as a (possibly zero-rated) VAT invoice

  // Default the invoice number from document settings (editable).
  useEffect(() => {
    if (docSettings && !invoiceNumber) {
      setInvoiceNumber(`${docSettings.invoicePrefix || 'INV-'}${docSettings.invoiceNextNumber || 1001}`);
    }
  }, [docSettings, invoiceNumber]);

  // If our own company is VAT registered, default to a tax invoice.
  useEffect(() => {
    if (docSettings?.vatRegistered) setTaxInvoice(true);
  }, [docSettings]);

  const total = useMemo(() => lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lineItems]);

  const prefillFromVendor = (vendorId: string) => {
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setName(v.name || '');
    setRegOrId(v.registration_number ? `Reg: ${v.registration_number}` : '');
    setVatNumber(v.vat_number || '');
    setAddress(v.address || '');
    setEmail(v.email || '');
    setPhone(v.phone || '');
    // A VAT-registered vendor needs a (zero-rated) VAT invoice.
    if (v.is_vat_registered || docSettings?.vatRegistered) setTaxInvoice(true);
  };

  const setItem = (i: number, patch: Partial<LineItem>) =>
    setLineItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addItem = () => setLineItems((prev) => [...prev, { description: '', amount: 0 }]);
  const removeItem = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));

  const download = () => {
    if (!docSettings) { toast.error('Document settings not loaded yet'); return; }
    if (!name.trim()) { toast.error('Enter who the invoice is billed to'); return; }
    const items = lineItems
      .filter((l) => l.description.trim() || Number(l.amount))
      .map((l) => ({ description: l.description.trim() || 'Item', amount: Number(l.amount) || 0 }));
    if (!items.length) { toast.error('Add at least one line item'); return; }

    const data: DealInvoiceData = {
      invoiceNumber: invoiceNumber.trim() || `${docSettings.invoicePrefix || 'INV-'}${docSettings.invoiceNextNumber || 1001}`,
      paymentReference: paymentReference.trim() || undefined,
      taxInvoice,
      vatRate: docSettings.vatRegistered ? (docSettings.vatPercent || 0) : 0, // zero-rated while we're not registered
      date: format(new Date(`${dateStr}T00:00:00`), 'dd MMM yyyy'),
      billTo: {
        name: name.trim(),
        regOrId: regOrId.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        address: address.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      notes: notes.trim() || undefined,
      lineItems: items,
      // no vehicleLines → general invoice (no VEHICLE block)
    };
    generateDealInvoicePDF(data, docSettings);
    toast.success('Invoice generated');
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Invoice Creator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build a standalone invoice for any party. Company &amp; banking details come from Document Settings.
          </p>
        </div>

        {/* Bill To */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Bill To</CardTitle>
            <CardDescription>Pick a vendor to prefill, or type any details — everything is editable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prefill from vendor (optional)</Label>
              <Select onValueChange={prefillFromVendor}>
                <SelectTrigger><SelectValue placeholder="Select a vendor…" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Bill-to name <span className="text-red-400">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company or person" />
              </div>
              <Field label="Reg / ID (e.g. Reg: 2008/…)" value={regOrId} onChange={setRegOrId} />
              <Field label="VAT Number" value={vatNumber} onChange={setVatNumber} />
              <Field label="Email" value={email} onChange={setEmail} />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice meta */}
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Invoice number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-1001" />
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
                  Titles it <strong>TAX INVOICE</strong> with a VAT line.
                  {docSettings?.vatRegistered
                    ? ` VAT at ${docSettings?.vatPercent || 0}%.`
                    : ' Zero-rated (VAT 0% — R0,00) while your company isn’t VAT-registered.'}
                </span>
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lineItems.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Description"
                  value={l.description}
                  onChange={(e) => setItem(i, { description: e.target.value })}
                  className="flex-1"
                />
                <Input
                  type="number" placeholder="Amount" className="w-36 text-right"
                  value={l.amount || ''}
                  onChange={(e) => setItem(i, { amount: parseFloat(e.target.value) || 0 })}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} aria-label="Remove">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
              <span>Total {taxInvoice ? `(incl. ${docSettings?.vatRegistered ? (docSettings?.vatPercent || 0) : 0}% VAT)` : '(no VAT)'}</span>
              <span className="tabular-nums">{fmtR(total)}</span>
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

        <div className="flex justify-end">
          <Button onClick={download} size="lg">
            <Download className="w-4 h-4 mr-2" /> Generate Invoice PDF
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default AdminInvoiceCreator;
