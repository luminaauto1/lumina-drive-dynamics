import { useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Printer, Save, ArrowLeft, Pencil, Trash2, Download, Loader2, X } from 'lucide-react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { pdfFilename } from '@/lib/domToPdf';
import { toast } from 'sonner';
import { useDocumentSettings, consumeOtpNumber } from '@/hooks/useDocumentSettings';
import { useOtps, useCreateOtp, useUpdateOtp, useDeleteOtp } from '@/hooks/useOtps';
import { OtpDocument } from '@/features/otp/OtpDocument';
import { blankOtp } from '@/features/otp/blank';
import type { OtpData, OtpClient, OtpVehicle, OtpFinance, OtpFinancials, OtpRecord } from '@/features/otp/types';
import { ClientSearchInput } from '@/components/admin/ClientSearchInput';
import { useVehiclesLite } from '@/hooks/useVehiclesLite';
import { fmtZAR, fmtOtpDate, addDaysOtpDate } from '@/features/otp/format';
import { calcOtp } from '@/features/otp/calc';
import './../../features/otp/otpPrint.css';

// blankOtp moved to features/otp/blank.ts — shared with the Deal Room popup.

const AdminOTP = () => {
  const { data: settings } = useDocumentSettings();
  const { data: otps = [] } = useOtps();
  const createOtp = useCreateOtp();
  const updateOtp = useUpdateOtp();
  const deleteOtp = useDeleteOtp();

  const { data: stock = [] } = useVehiclesLite();
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [downloading, setDownloading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [data, setData] = useState<OtpData | null>(null);
  const [saving, setSaving] = useState(false);

  const calc = useMemo(() => (data ? calcOtp(data) : null), [data]);

  const startNew = () => {
    if (!settings) return;
    setData(blankOtp(settings));
    setEditingId(null);
    setView('edit');
  };

  const startEdit = (rec: OtpRecord) => {
    setData(rec.data);
    setEditingId(rec.id);
    setView('edit');
  };

  // Section updaters
  const setClient = (p: Partial<OtpClient>) => setData((d) => (d ? { ...d, client: { ...d.client, ...p } } : d));
  const setVehicle = (p: Partial<OtpVehicle>) => setData((d) => (d ? { ...d, vehicle: { ...d.vehicle, ...p } } : d));
  const setFinance = (p: Partial<OtpFinance>) => setData((d) => (d ? { ...d, finance: { ...d.finance, ...p } } : d));
  const setFin = (p: Partial<OtpFinancials>) => setData((d) => (d ? { ...d, financials: { ...d.financials, ...p } } : d));
  const setLine = (k: keyof OtpData['lines'], v: boolean) =>
    setData((d) => (d ? { ...d, lines: { ...d.lines, [k]: v } } : d));
  const setOfferField = (k: 'date' | 'valid_until', v: string) =>
    setData((d) => (d ? { ...d, offer: { ...d.offer, [k]: v } } : d));

  const validate = (d: OtpData): string | null => {
    if (!d.client.name.trim()) return 'Client name is required';
    if (!d.vehicle.make.trim() || !d.vehicle.model.trim() || !d.vehicle.year.trim())
      return 'Vehicle make, model and year are required';
    if (!d.financials.base_price) return 'Base vehicle price is required';
    return null;
  };

  const handleSave = async () => {
    if (!data || !settings) return;
    const err = validate(data);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateOtp.mutateAsync({ id: editingId, data });
        toast.success('OTP updated');
      } else {
        const ref = await consumeOtpNumber(settings);
        const withRef = { ...data, offer: { ...data.offer, ref } };
        const rec = await createOtp.mutateAsync({ ref, data: withRef });
        setData(withRef);
        setEditingId(rec.id);
        toast.success(`OTP ${ref} saved`);
      }
    } finally {
      setSaving(false);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<OtpRecord | null>(null);
  const handleDelete = async (rec: OtpRecord) => {
    await deleteOtp.mutateAsync(rec.id);
    toast.success('OTP deleted');
  };

  const moneyInput = (label: string, value: number, onChange: (n: number) => void) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );

  const textInput = (label: string, value: string, onChange: (v: string) => void, span2 = false) => (
    <div className={`space-y-1.5 ${span2 ? 'col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  // ---------------- LIST ----------------
  if (view === 'list') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" /> Offers to Purchase
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Generate, save and re-export branded OTPs.</p>
            </div>
            <Button onClick={startNew} className="gap-2"><Plus className="w-4 h-4" /> New OTP</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr className="text-left">
                    <th className="p-3 font-medium">Ref</th>
                    <th className="p-3 font-medium">Client</th>
                    <th className="p-3 font-medium">Vehicle</th>
                    <th className="p-3 font-medium text-right">Balance</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {otps.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No OTPs yet. Click “New OTP”.</td></tr>
                  )}
                  {otps.map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3 font-mono">{rec.ref}</td>
                      <td className="p-3">{rec.client_name}</td>
                      <td className="p-3">{rec.vehicle}</td>
                      <td className="p-3 text-right font-mono">{rec.balance != null ? fmtZAR(rec.balance) : '—'}</td>
                      <td className="p-3">{new Date(rec.created_at).toLocaleDateString('en-ZA')}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(rec)} className="gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(rec)} className="gap-1 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
        <ConfirmDialog
          open={!!confirmDelete}
          title="Delete OTP?"
          description={confirmDelete ? `Delete OTP ${confirmDelete.ref}? This cannot be undone.` : undefined}
          onConfirm={() => { if (confirmDelete) void handleDelete(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      </AdminLayout>
    );
  }

  // ---------------- EDITOR ----------------
  if (!data) return null;

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">{data.offer.ref || '(ref assigned on save)'}</span>
            <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" size="icon" onClick={() => window.print()} title="Print (physical printer)"><Printer className="w-4 h-4" /></Button>
            <Button
              onClick={async () => {
                setDownloading(true);
                try {
                  // Real-text vector PDF (crisp Montserrat, ~130KB — the owner's
                  // reference print-quality look), rendered off the same OtpData
                  // as the on-screen preview. Lazy import keeps the renderer out
                  // of the main bundle.
                  const { downloadOtpPdf } = await import('@/features/otp/pdf/download');
                  await downloadOtpPdf(data, pdfFilename('OTP', data.offer.ref || 'draft', data.client.name || 'client'));
                } catch (e: any) {
                  toast.error('PDF download failed: ' + (e?.message || e));
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <div className="space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Client</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {/* Prefill from an existing client (owner 2026-07-17) — everything stays editable. */}
                <div className="col-span-2">
                  <ClientSearchInput
                    label="Prefill from a client"
                    onPick={(c) => setClient({
                      name: c.name,
                      id: c.idNumber,
                      cell: c.phone,
                      email: c.email,
                      address: c.address,
                      postal: c.postalCode,
                    })}
                  />
                </div>
                {textInput('Title', data.client.title, (v) => setClient({ title: v }))}
                {textInput('Name', data.client.name, (v) => setClient({ name: v }))}
                {textInput('ID Number', data.client.id, (v) => setClient({ id: v }))}
                {textInput('Cell', data.client.cell, (v) => setClient({ cell: v }))}
                {textInput('Email', data.client.email, (v) => setClient({ email: v }))}
                {textInput('Postal', data.client.postal, (v) => setClient({ postal: v }))}
                {textInput('Address', data.client.address, (v) => setClient({ address: v }), true)}
                {textInput('Sales Exec', data.sales.exec_name, (v) => setData((d) => (d ? { ...d, sales: { ...d.sales, exec_name: v } } : d)))}
                {textInput('Sales Exec Phone', data.sales.exec_phone, (v) => setData((d) => (d ? { ...d, sales: { ...d.sales, exec_phone: v } } : d)))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Vehicle</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {/* Prefill from stock (owner 2026-07-17) — same picker as the Invoice
                    Creator; the base price fills only when still empty. */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Prefill from stock</Label>
                  <Select onValueChange={(vehicleId) => {
                    const v = stock.find((x: any) => x.id === vehicleId);
                    if (!v) return;
                    setVehicle({
                      make: v.make || '',
                      model: v.model || '',
                      year: v.year ? String(v.year) : '',
                      colour: v.color || '',
                      trim: v.variant || '',
                      mileage: v.mileage != null ? String(v.mileage) : '',
                      vin: v.vin || '',
                      engine_no: v.engine_code || '',
                      reg_no: v.registration_number || '',
                      stock_no: v.stock_number || '',
                    });
                    if (!data.financials.base_price && v.price) setFin({ base_price: Number(v.price) });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select a vehicle…" /></SelectTrigger>
                    <SelectContent>
                      {stock.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {[v.stock_number ? `#${v.stock_number}` : null, v.year, v.make, v.model, v.variant].filter(Boolean).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {textInput('Make', data.vehicle.make, (v) => setVehicle({ make: v }))}
                {textInput('Model', data.vehicle.model, (v) => setVehicle({ model: v }))}
                {textInput('Year', data.vehicle.year, (v) => setVehicle({ year: v }))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Order Type</Label>
                  <Select value={data.vehicle.order_type} onValueChange={(v) => setVehicle({ order_type: v as OtpVehicle['order_type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Used">Used</SelectItem>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Demo">Demo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {textInput('Reg No', data.vehicle.reg_no, (v) => setVehicle({ reg_no: v }))}
                {textInput('Mileage', data.vehicle.mileage, (v) => setVehicle({ mileage: v }))}
                {textInput('Colour', data.vehicle.colour, (v) => setVehicle({ colour: v }))}
                {textInput('Trim', data.vehicle.trim, (v) => setVehicle({ trim: v }))}
                {textInput('VIN', data.vehicle.vin, (v) => setVehicle({ vin: v }))}
                {textInput('Engine No', data.vehicle.engine_no, (v) => setVehicle({ engine_no: v }))}
                {textInput('Stock No', data.vehicle.stock_no, (v) => setVehicle({ stock_no: v }))}
                {textInput('M&M Code', data.vehicle.mm_code, (v) => setVehicle({ mm_code: v }))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Finance</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select value={data.finance.method} onValueChange={(v) => setFinance({ method: v as OtpFinance['method'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Finance">Bank Finance</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Unspecified">Unspecified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {textInput('Financed By', data.finance.financed_by, (v) => setFinance({ financed_by: v }))}
                {textInput('Bank / Branch', data.finance.bank_branch, (v) => setFinance({ bank_branch: v }))}
                {textInput('Branch Phone', data.finance.branch_phone, (v) => setFinance({ branch_phone: v }))}
                {textInput('Branch Contact', data.finance.branch_contact, (v) => setFinance({ branch_contact: v }), true)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Financials (VAT-inclusive inputs)</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {moneyInput('Base Vehicle Price', data.financials.base_price, (n) => setFin({ base_price: n }))}
                {/* Extras as LINE ITEMS (owner 2026-07-17) — each prints on the OTP;
                    financials.extras stays their sum so calc/legacy docs are untouched. */}
                {(() => {
                  const items = data.financials.extras_items
                    ?? (data.financials.extras ? [{ description: 'Extras', amount: data.financials.extras }] : []);
                  const commit = (next: { description: string; amount: number }[]) =>
                    setFin({ extras_items: next, extras: next.reduce((s, i) => s + (Number(i.amount) || 0), 0) });
                  return (
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Extras (line items — each prints on the OTP)</Label>
                      {items.map((it, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input value={it.description} placeholder="e.g. Tow bar"
                            onChange={(e) => commit(items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} />
                          <Input type="number" value={it.amount || ''} placeholder="0.00" className="w-36"
                            onChange={(e) => commit(items.map((x, idx) => idx === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} />
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
                            onClick={() => commit(items.filter((_, idx) => idx !== i))} title="Remove extra"><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <Button type="button" variant="outline" size="sm" className="h-7"
                          onClick={() => commit([...items, { description: '', amount: 0 }])}>
                          + Add extra
                        </Button>
                        {items.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Extras total: <span className="font-mono text-foreground">{fmtZAR(data.financials.extras)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {moneyInput('Value Added Products', data.financials.vap, (n) => setFin({ vap: n }))}
                {moneyInput('Administration Fee', data.financials.admin_fee, (n) => setFin({ admin_fee: n }))}
                {moneyInput('Delivery Fee', data.financials.delivery_fee, (n) => setFin({ delivery_fee: n }))}
                {moneyInput('Licensing & Registration (no VAT)', data.financials.licensing, (n) => setFin({ licensing: n }))}
                {moneyInput('Deposit', data.financials.deposit, (n) => setFin({ deposit: n }))}
                <div className="col-span-2 flex flex-wrap gap-4 pt-1">
                  {(['extras', 'vap', 'admin_fee', 'delivery_fee', 'licensing'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={data.lines[k]} onCheckedChange={(c) => setLine(k, !!c)} />
                      Show {k.replace('_', ' ')}
                    </label>
                  ))}
                </div>
                {calc && (
                  <div className="col-span-2 text-sm text-muted-foreground border-t pt-3 mt-1 space-y-1">
                    <div className="flex justify-between"><span>Total Price</span><span className="font-mono">{fmtZAR(calc.totalIncl)}</span></div>
                    <div className="flex justify-between"><span>Less: Deposit</span><span className="font-mono">- {fmtZAR(calc.deposit)}</span></div>
                    <div className="flex justify-between font-semibold text-foreground"><span>Balance Payable</span><span className="font-mono">{fmtZAR(calc.balance)}</span></div>
                    {!calc.vatRegistered && <p className="text-xs pt-1">{calc.vatNote}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Offer & Notes</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {textInput('Date', data.offer.date, (v) => setOfferField('date', v))}
                {textInput('Valid Until', data.offer.valid_until, (v) => setOfferField('valid_until', v))}
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={data.notes} onChange={(e) => setData((d) => (d ? { ...d, notes: e.target.value } : d))} rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LIVE PREVIEW */}
          <div className="bg-muted/30 rounded-lg p-4 overflow-auto max-h-[calc(100vh-160px)]">
            <div className="otp-print-root otp-preview-wrap origin-top" style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: '210mm' }}>
              <div>
                <OtpDocument data={data} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOTP;
