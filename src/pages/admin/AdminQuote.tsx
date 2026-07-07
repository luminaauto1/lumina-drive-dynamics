import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Printer, Save, ArrowLeft, Pencil, Trash2, Upload, ImageOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentSettings, consumeQuoteNumber } from '@/hooks/useDocumentSettings';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';
import { useQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote } from '@/hooks/useQuotes';
import { QuoteDocument } from '@/features/quote/QuoteDocument';
import type { QuoteData, QuoteClient, QuoteVehicle, QuoteRecord, QuoteLineItem } from '@/features/quote/types';
import { calcQuote } from '@/features/quote/calc';
import { fmtR, fmtDate, addDaysDate } from '@/features/quote/format';
import '@/features/quote/quotePrint.css';

const QUOTE_IMAGE_BUCKET = 'quote-vehicle-images';

/** Compute the validity display + ISO fields from a base date and a day count. */
const validity = (base: Date, days: number) => {
  const until = new Date(base);
  until.setDate(base.getDate() + (Number.isFinite(days) ? days : 0));
  return {
    valid_until: addDaysDate(days, base),
    valid_until_iso: until.toISOString().slice(0, 10),
  };
};

/** Vehicle "sale summary" title — "{make} {model} {variant}" (no year). */
const vehicleTitle = (v: Pick<QuoteVehicle, 'make' | 'model' | 'variant'>) =>
  [v.make, v.model, v.variant].map((s) => (s || '').trim()).filter(Boolean).join(' ');

const blankQuote = (s: DocumentSettings, repName: string): QuoteData => {
  const now = new Date();
  const days = s.quoteValidityDays || 7;
  return {
    company: {
      legal_name: s.companyLegalName,
      trading_name: s.companyTradingName,
      address: s.companyAddress,
      email: s.companyEmail,
      phone: s.companyPhone,
      reg_no: s.companyRegNumber,
      vat_no: s.vatRegistered ? s.companyVatNumber || 'N/A' : '',
    },
    quote: {
      ref: '',
      date: fmtDate(now),
      validity_days: days,
      ...validity(now, days),
    },
    client: { name: '', id_number: '', cell: '', email: '', address: '' },
    vehicle: {
      year: '', make: '', model: '', variant: '', title: '',
      color: '', mileage: '', reg_no: '', vin: '', engine_no: '', mm_code: '',
      stock_no: '', transmission: '', image_url: null,
    },
    accessories: [],
    vaps: [],
    retail_price: 0,
    comments: '',
    sales_rep: { name: repName, cell: '' },
    vat_registered: s.vatRegistered,
    vat_number: s.companyVatNumber,
  };
};

const AdminQuote = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('app');

  const { data: settings } = useDocumentSettings();
  const { data: quotes = [] } = useQuotes();
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();

  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [data, setData] = useState<QuoteData | null>(null);
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [defaultRep, setDefaultRep] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const prefilledFor = useRef<string | null>(null);

  const calc = useMemo(() => (data ? calcQuote(data) : null), [data]);

  // Resolve the default sales rep: quoteSalesExecutive || otpSalesExecutive ||
  // first configured sales_reps entry name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const configured = settings?.quoteSalesExecutive || settings?.otpSalesExecutive || '';
      if (configured) { if (!cancelled) setDefaultRep(configured); return; }
      const { data: row } = await (supabase as any)
        .from('site_settings').select('sales_reps').limit(1).maybeSingle();
      const reps = (row?.sales_reps || []) as Array<{ name?: string }>;
      if (!cancelled) setDefaultRep(reps[0]?.name || '');
    })();
    return () => { cancelled = true; };
  }, [settings?.quoteSalesExecutive, settings?.otpSalesExecutive]);

  const startNew = () => {
    if (!settings) return;
    const now = new Date();
    setBaseDate(now);
    setData(blankQuote(settings, defaultRep));
    setEditingId(null);
    setView('edit');
  };

  const startEdit = (rec: QuoteRecord) => {
    setData(rec.data);
    setEditingId(rec.id);
    setView('edit');
  };

  // ---- PREFILL from a finance application (?app=<id>) ----------------------
  useEffect(() => {
    if (!appId || !settings) return;
    if (prefilledFor.current === appId) return; // guard against re-runs
    prefilledFor.current = appId;
    let cancelled = false;

    (async () => {
      const now = new Date();
      const base = blankQuote(settings, settings.quoteSalesExecutive || settings.otpSalesExecutive || defaultRep);

      const { data: app } = await supabase
        .from('finance_applications')
        .select('full_name, first_name, last_name, id_number, email, phone, street_address, selected_vehicle_id, vehicle_id')
        .eq('id', appId)
        .maybeSingle();

      if (app) {
        const name = (app.full_name || [app.first_name, app.last_name].filter(Boolean).join(' ')).trim();
        base.client = {
          name,
          id_number: app.id_number || '',
          cell: app.phone || '',
          email: app.email || '',
          address: app.street_address || '',
        };

        const vid = (app as any).selected_vehicle_id || (app as any).vehicle_id;
        if (vid) {
          const { data: v } = await supabase
            .from('vehicles')
            .select('make,model,variant,year,color,mileage,registration_number,vin,engine_code,stock_number,transmission,fuel_type,price,images')
            .eq('id', vid)
            .maybeSingle();
          if (v) {
            base.vehicle = {
              year: v.year != null ? String(v.year) : '',
              make: v.make || '',
              model: v.model || '',
              variant: v.variant || '',
              title: vehicleTitle({ make: v.make || '', model: v.model || '', variant: v.variant || '' }),
              color: v.color || '',
              mileage: v.mileage != null ? String(v.mileage) : '',
              reg_no: v.registration_number || '',
              vin: v.vin || '',
              engine_no: v.engine_code || '',
              mm_code: '',
              stock_no: v.stock_number || '',
              transmission: v.transmission || '',
              image_url: Array.isArray(v.images) && v.images.length > 0 ? v.images[0] : null,
            };
            base.retail_price = Number(v.price) || 0;
          }
        }
      }

      if (cancelled) return;
      setBaseDate(now);
      setData(base);
      setEditingId(null);
      setView('edit');
      // Clear the ?app param so a manual "Back" + "New Quote" starts clean.
      setSearchParams({}, { replace: true });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, settings]);

  // ---- Section updaters ----------------------------------------------------
  const setClient = (p: Partial<QuoteClient>) =>
    setData((d) => (d ? { ...d, client: { ...d.client, ...p } } : d));

  const setVehicle = (p: Partial<QuoteVehicle>) =>
    setData((d) => {
      if (!d) return d;
      const vehicle = { ...d.vehicle, ...p };
      // Keep the sale-summary title in sync with make/model/variant.
      if ('make' in p || 'model' in p || 'variant' in p) vehicle.title = vehicleTitle(vehicle);
      return { ...d, vehicle };
    });

  const setValidityDays = (days: number) =>
    setData((d) =>
      d ? { ...d, quote: { ...d.quote, validity_days: days, ...validity(baseDate, days) } } : d,
    );

  // Repeatable line-item helpers (accessories / vaps).
  const addLine = (key: 'accessories' | 'vaps') =>
    setData((d) => (d ? { ...d, [key]: [...d[key], { description: '', amount: 0 }] } : d));
  const setLineItem = (key: 'accessories' | 'vaps', i: number, patch: Partial<QuoteLineItem>) =>
    setData((d) =>
      d ? { ...d, [key]: d[key].map((r, idx) => (idx === i ? { ...r, ...patch } : r)) } : d,
    );
  const removeLine = (key: 'accessories' | 'vaps', i: number) =>
    setData((d) => (d ? { ...d, [key]: d[key].filter((_, idx) => idx !== i) } : d));

  // ---- Image upload / remove ----------------------------------------------
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(QUOTE_IMAGE_BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(QUOTE_IMAGE_BUCKET).getPublicUrl(path);
      setVehicle({ image_url: pub.publicUrl });
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error('Upload failed: ' + (e?.message || 'unknown error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ---- Save ----------------------------------------------------------------
  const validate = (d: QuoteData): string | null => {
    if (!d.client.name.trim()) return 'Client name is required';
    return null;
  };

  const handleSave = async () => {
    if (!data || !settings) return;
    const err = validate(data);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateQuote.mutateAsync({ id: editingId, data });
        toast.success('Quote updated');
      } else {
        const ref = await consumeQuoteNumber(settings);
        const withRef = { ...data, quote: { ...data.quote, ref } };
        const rec = await createQuote.mutateAsync({ ref, data: withRef });
        setData(withRef);
        setEditingId(rec.id);
        toast.success(`Quote ${ref} saved`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec: QuoteRecord) => {
    if (!window.confirm(`Delete quote ${rec.ref}? This cannot be undone.`)) return;
    await deleteQuote.mutateAsync(rec.id);
    toast.success('Quote deleted');
  };

  // ---- Small field helpers -------------------------------------------------
  const textInput = (label: string, value: string, onChange: (v: string) => void, span2 = false) => (
    <div className={`space-y-1.5 ${span2 ? 'col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  const lineTable = (key: 'accessories' | 'vaps', title: string) => {
    if (!data) return null;
    const items = data[key];
    const total = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
    return (
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => addLine(key)} className="gap-1 h-7">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No items. Click “Add”.</p>
          )}
          {items.map((it, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={it.description} onChange={(e) => setLineItem(key, i, { description: e.target.value })} />
              </div>
              <div className="w-32 space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input type="number" value={it.amount} onChange={(e) => setLineItem(key, i, { amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeLine(key, i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-sm font-medium">
            <span>Nett Total</span><span className="font-mono">{fmtR(total)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---------------- LIST ----------------
  if (view === 'list') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" /> Quotations
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Build, save and re-export branded vehicle quotations.</p>
            </div>
            <Button onClick={startNew} className="gap-2"><Plus className="w-4 h-4" /> New Quote</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr className="text-left">
                    <th className="p-3 font-medium">Ref</th>
                    <th className="p-3 font-medium">Client</th>
                    <th className="p-3 font-medium">Vehicle</th>
                    <th className="p-3 font-medium text-right">Total</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No quotes yet. Click “New Quote”.</td></tr>
                  )}
                  {quotes.map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3 font-mono">{rec.ref}</td>
                      <td className="p-3">{rec.client_name || '—'}</td>
                      <td className="p-3">{rec.vehicle || '—'}</td>
                      <td className="p-3 text-right font-mono">{rec.total != null ? fmtR(rec.total) : '—'}</td>
                      <td className="p-3">{new Date(rec.created_at).toLocaleDateString('en-ZA')}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(rec)} className="gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rec)} className="gap-1 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
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
            <span className="text-sm text-muted-foreground font-mono">{data.quote.ref || '(ref assigned on save)'}</span>
            <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Quote'}</Button>
            <Button onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" /> Download PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <div className="space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Client</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {textInput('Name', data.client.name, (v) => setClient({ name: v }))}
                {textInput('ID / Passport', data.client.id_number, (v) => setClient({ id_number: v }))}
                {textInput('Cell', data.client.cell, (v) => setClient({ cell: v }))}
                {textInput('Email', data.client.email, (v) => setClient({ email: v }))}
                {textInput('Address', data.client.address, (v) => setClient({ address: v }), true)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Vehicle</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {textInput('Year', data.vehicle.year, (v) => setVehicle({ year: v }))}
                {textInput('Make', data.vehicle.make, (v) => setVehicle({ make: v }))}
                {textInput('Model', data.vehicle.model, (v) => setVehicle({ model: v }))}
                {textInput('Variant', data.vehicle.variant, (v) => setVehicle({ variant: v }))}
                {textInput('Colour', data.vehicle.color, (v) => setVehicle({ color: v }))}
                {textInput('Mileage', data.vehicle.mileage, (v) => setVehicle({ mileage: v }))}
                {textInput('Reg No', data.vehicle.reg_no, (v) => setVehicle({ reg_no: v }))}
                {textInput('VIN No', data.vehicle.vin, (v) => setVehicle({ vin: v }))}
                {textInput('Engine No', data.vehicle.engine_no, (v) => setVehicle({ engine_no: v }))}
                {textInput('M&M Code', data.vehicle.mm_code, (v) => setVehicle({ mm_code: v }))}
                {textInput('Stock No', data.vehicle.stock_no, (v) => setVehicle({ stock_no: v }))}
                {textInput('Transmission', data.vehicle.transmission, (v) => setVehicle({ transmission: v }))}
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Retail Price</Label>
                  <Input type="number" value={data.retail_price} onChange={(e) => setData((d) => (d ? { ...d, retail_price: parseFloat(e.target.value) || 0 } : d))} />
                </div>

                {/* Vehicle image */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs">Vehicle Image</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-20 rounded-md border border-border overflow-hidden bg-muted/40 flex items-center justify-center shrink-0">
                      {data.vehicle.image_url ? (
                        <img src={data.vehicle.image_url} alt="Vehicle" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                      />
                      <Button variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {data.vehicle.image_url ? 'Replace' : 'Upload'}
                      </Button>
                      {data.vehicle.image_url && (
                        <Button variant="ghost" size="sm" className="gap-2 text-destructive" onClick={() => setVehicle({ image_url: null })}>
                          <ImageOff className="w-3.5 h-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {lineTable('accessories', 'Accessories')}
            {lineTable('vaps', 'Value Added Products')}

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Sales Rep & Validity</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {textInput('Sales Rep Name', data.sales_rep.name, (v) => setData((d) => (d ? { ...d, sales_rep: { ...d.sales_rep, name: v } } : d)))}
                {textInput('Sales Rep Cell', data.sales_rep.cell, (v) => setData((d) => (d ? { ...d, sales_rep: { ...d.sales_rep, cell: v } } : d)))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Validity (days)</Label>
                  <Input type="number" value={data.quote.validity_days} onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valid Until</Label>
                  <Input value={data.quote.valid_until} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Comments</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={data.comments} onChange={(e) => setData((d) => (d ? { ...d, comments: e.target.value } : d))} rows={3} />
                {calc && (
                  <div className="text-sm text-muted-foreground border-t pt-3 mt-3 space-y-1">
                    <div className="flex justify-between"><span>Retail Price</span><span className="font-mono">{fmtR(data.retail_price)}</span></div>
                    <div className="flex justify-between"><span>Accessories</span><span className="font-mono">{fmtR(calc.accessoriesTotal)}</span></div>
                    <div className="flex justify-between"><span>Value Added Products</span><span className="font-mono">{fmtR(calc.vapsTotal)}</span></div>
                    <div className="flex justify-between font-semibold text-foreground"><span>Total Due</span><span className="font-mono">{fmtR(calc.total)}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* LIVE PREVIEW */}
          <div className="bg-muted/30 rounded-lg p-4 overflow-auto max-h-[calc(100vh-160px)]">
            <div className="quote-print-root quote-preview-wrap origin-top" style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: '210mm' }}>
              <QuoteDocument data={data} />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQuote;
