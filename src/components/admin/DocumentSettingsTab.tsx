import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText, Building2, Banknote, Receipt, ClipboardList } from 'lucide-react';
import {
  useDocumentSettings, useUpdateDocumentSettings, DEFAULT_DOCUMENT_SETTINGS, DocumentSettings,
} from '@/hooks/useDocumentSettings';

// Module-level field components (defined OUTSIDE the tab so they keep focus on each keystroke).
const Field = ({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string | number; onChange: (v: any) => void; type?: string; placeholder?: string;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      type={type}
      value={value as any}
      placeholder={placeholder}
      onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
    />
  </div>
);

const AreaField = ({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} />
  </div>
);

/** Customizable company / banking / invoice / OTP document settings.
 *  Self-contained (own save), so it lives safely inside the AdminSettings form. */
const DocumentSettingsTab = () => {
  const { data, isLoading } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const [form, setForm] = useState<DocumentSettings>(DEFAULT_DOCUMENT_SETTINGS);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const set = (k: keyof DocumentSettings, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">Company details used on Invoices and Offers to Purchase (OTP).</p>
      </div>

      {/* Company */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Building2 className="w-4 h-4 text-muted-foreground" /> Company</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Trading name" value={form.companyTradingName} onChange={(v) => set('companyTradingName', v)} />
          <Field label="Legal entity name" value={form.companyLegalName} onChange={(v) => set('companyLegalName', v)} />
          <Field label="Phone" value={form.companyPhone} onChange={(v) => set('companyPhone', v)} />
          <Field label="Email" value={form.companyEmail} onChange={(v) => set('companyEmail', v)} />
          <Field label="VAT number" value={form.companyVatNumber} onChange={(v) => set('companyVatNumber', v)} placeholder="4xxxxxxxxx" />
          <Field label="Company reg. number" value={form.companyRegNumber} onChange={(v) => set('companyRegNumber', v)} />
        </div>
        <AreaField label="Address" value={form.companyAddress} onChange={(v) => set('companyAddress', v)} />
      </section>

      {/* Banking */}
      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Banknote className="w-4 h-4 text-muted-foreground" /> Banking (shown on invoices)</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Account name" value={form.bankAccountName} onChange={(v) => set('bankAccountName', v)} />
          <Field label="Bank" value={form.bankName} onChange={(v) => set('bankName', v)} />
          <Field label="Account number" value={form.bankAccountNumber} onChange={(v) => set('bankAccountNumber', v)} />
          <Field label="Branch code" value={form.bankBranchCode} onChange={(v) => set('bankBranchCode', v)} />
          <Field label="Account type" value={form.bankAccountType} onChange={(v) => set('bankAccountType', v)} />
        </div>
      </section>

      {/* Invoice */}
      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Receipt className="w-4 h-4 text-muted-foreground" /> Invoice</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Number prefix" value={form.invoicePrefix} onChange={(v) => set('invoicePrefix', v)} placeholder="INV-" />
          <Field label="Next number" type="number" value={form.invoiceNextNumber} onChange={(v) => set('invoiceNextNumber', v)} />
          <Field label="VAT %" type="number" value={form.vatPercent} onChange={(v) => set('vatPercent', v)} />
          <Field label="Default admin fee" type="number" value={form.defaultAdminFee} onChange={(v) => set('defaultAdminFee', v)} />
        </div>
        <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 cursor-pointer">
          <Checkbox
            className="mt-0.5"
            checked={!!form.vatRegistered}
            onCheckedChange={(c) => set('vatRegistered', c === true)}
          />
          <span className="text-sm">
            <span className="font-medium">We are VAT registered</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              On → invoices are issued as a <strong>TAX INVOICE</strong> with a VAT line at the “VAT %” above
              (set it to 0 to show <strong>VAT R0,00</strong> — a valid VAT invoice with no VAT charged).
              Off → a plain “Invoice” with no VAT line.
            </span>
          </span>
        </label>
        <AreaField label="Invoice terms / footer note" value={form.invoiceTerms} onChange={(v) => set('invoiceTerms', v)} />
        <AreaField
          label="Conditions of sale (printed on motor-trade vehicle invoices)"
          value={form.invoiceConditions}
          onChange={(v) => set('invoiceConditions', v)}
        />
      </section>

      {/* OTP */}
      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FileText className="w-4 h-4 text-muted-foreground" /> Offer to Purchase (OTP)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Ref prefix" value={form.otpPrefix} onChange={(v) => set('otpPrefix', v)} placeholder="OTP-" />
          <Field label="Next number" type="number" value={form.otpNextNumber} onChange={(v) => set('otpNextNumber', v)} />
          <Field label="Validity (days)" type="number" value={form.otpValidityDays} onChange={(v) => set('otpValidityDays', v)} />
          <Field label="Default sales executive" value={form.otpSalesExecutive} onChange={(v) => set('otpSalesExecutive', v)} />
          <Field label="Default delivery fee" type="number" value={form.otpDefaultDeliveryFee} onChange={(v) => set('otpDefaultDeliveryFee', v)} />
          <Field label="Default licensing & reg" type="number" value={form.otpDefaultLicensing} onChange={(v) => set('otpDefaultLicensing', v)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Fee lines shown by default</Label>
          <div className="flex flex-wrap gap-4">
            {(['extras', 'vap', 'admin_fee', 'delivery_fee', 'licensing'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={!!form.otpLines?.[k]}
                  onCheckedChange={(c) => set('otpLines', { ...form.otpLines, [k]: c === true })}
                />
                {k.replace('_', ' ')}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            VAT shows as <strong>n/a</strong> until “We are VAT registered” (above) is on — Licensing &amp; Registration never carries VAT.
          </p>
        </div>
        <AreaField
          label="Custom OTP terms (optional — leave blank to use the built-in legal terms)"
          value={form.otpTerms}
          onChange={(v) => set('otpTerms', v)}
        />
      </section>

      {/* Deals automation */}
      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ClipboardList className="w-4 h-4 text-muted-foreground" /> Deals</h3>
        <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 cursor-pointer">
          <Checkbox
            className="mt-0.5"
            checked={!!form.autoCreateDealOnContractSigned}
            onCheckedChange={(c) => set('autoCreateDealOnContractSigned', c === true)}
          />
          <span className="text-sm">
            <span className="font-medium">Auto-create a Deal Desk draft when a contract is signed</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              When on, moving a finance application to <strong>Contract Signed</strong> automatically creates a
              <strong> draft deal</strong> (all figures zero, no sale date) so it appears in Deal Desk ready to finalize.
              Drafts are visible to admins only and never count toward Accounting or Reports until you finalize them.
              Off (default) → nothing changes; deals are created only from the Finalize Deal modal as before.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 cursor-pointer">
          <Checkbox
            className="mt-0.5"
            checked={!!form.creditScanAutoSubmit}
            onCheckedChange={(c) => set('creditScanAutoSubmit', c === true)}
          />
          <span className="text-sm">
            <span className="font-medium">Auto-submit credit scans (CarTrust)</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              When ON, the ⚡ credit-scan bookmark ticks consent and clicks Generate Report itself.
              OFF (default) fills the form and stops so you review the details and submit yourself —
              nothing is billed until you do.
            </span>
          </span>
        </label>
      </section>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" onClick={() => update.mutate(form)} disabled={update.isPending} className="w-full sm:w-auto">
          {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save document settings
        </Button>
      </div>
    </div>
  );
};

export default DocumentSettingsTab;
