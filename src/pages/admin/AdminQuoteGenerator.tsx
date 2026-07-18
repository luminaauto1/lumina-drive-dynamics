import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Pencil, Plus, X, Copy, Check, Calculator, ChevronDown } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import {
  useDocumentSettings,
  useUpdateDocumentSettings,
  DEFAULT_DOCUMENT_SETTINGS,
  type DocumentSettings,
} from '@/hooks/useDocumentSettings';
import {
  calcFinanceQuote,
  formatRand,
  type QuoteAddon,
  type QuoteCover,
} from '@/lib/financeCalc';

/* ───────── fallback defaults (used until settings load / when absent) ───────── */
const FALLBACK_RATE = 13.5;
const DEFAULT_TERM = 72;
const FALLBACK_RESIDUAL = 0;
const DEFAULT_BANK_DOC_FEE = 1207;

/* Financed add-on line items (Saker sheet) — all default to 0.
   Ids are stable keys; labels are the built-in defaults and can be renamed for
   everyone via document_settings.quoteAddonLabels (id → custom label). */
const makeAddons = (): QuoteAddon[] => [
  { id: 'admin', label: 'Admin Fee', amount: 0 },
  { id: 'license', label: 'License & Reg', amount: 0 },
  { id: 'oem', label: 'OEM Extra', amount: 0 },
  { id: 'service', label: 'Service Plan', amount: 0 },
  { id: 'dent', label: 'Dent Repair', amount: 0 },
  { id: 'master', label: 'Master Car', amount: 0 },
  { id: 'smash', label: 'Smash & Grab', amount: 0 },
];

/* Monthly covers — editable list, default a couple of zero rows. */
const makeCovers = (): QuoteCover[] => [
  { id: crypto.randomUUID(), label: 'Warranty', amount: 0 },
  { id: crypto.randomUUID(), label: 'Trade Shield', amount: 0 },
];

/* ───────── small input field ───────── */
interface FieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}

const NumberField = ({ label, value, onChange, prefix, suffix, step, hint }: FieldProps) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">{label}</Label>
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-xs text-muted-foreground font-medium w-4">{prefix}</span>}
      <Input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="font-mono h-8 text-sm"
        step={step}
      />
      {suffix && <span className="text-xs text-muted-foreground w-8 text-right">{suffix}</span>}
    </div>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

/* ───────── results row ───────── */
const ResultRow = ({
  label,
  value,
  op,
  muted,
}: {
  label: string;
  value: string;
  op?: '+' | '=';
  muted?: boolean;
}) => (
  <div className="flex items-center justify-between text-sm">
    <span className={muted ? 'text-muted-foreground' : ''}>
      {op && <span className="text-muted-foreground mr-1">{op}</span>}
      {label}
    </span>
    <span className="font-mono">{value}</span>
  </div>
);

/* ───────── main ───────── */
const AdminQuoteGenerator = () => {
  const { data: settings } = useSiteSettings();
  const { data: docSettings } = useDocumentSettings();
  const updateDocSettings = useUpdateDocumentSettings();

  const [vehiclePrice, setVehiclePrice] = useState(305000);
  const [deposit, setDeposit] = useState(0);
  const [rate, setRate] = useState<number | null>(null); // null => use settings/fallback
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [residual, setResidual] = useState<number | null>(null);
  const [residualAmount, setResidualAmount] = useState<number | null>(null);
  const [balloonMode, setBalloonMode] = useState<'pct' | 'amount'>('pct');
  const [bankDocFee, setBankDocFee] = useState(DEFAULT_BANK_DOC_FEE);
  const [addons, setAddons] = useState<QuoteAddon[]>(makeAddons);
  const [covers, setCovers] = useState<QuoteCover[]>(makeCovers);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Rename mode for the add-on labels (shared, persisted per addon id). */
  const [editingLabels, setEditingLabels] = useState(false);
  const [labelDraft, setLabelDraft] = useState<Record<string, string>>({});

  /* Effective label: admin override from document settings, else built-in. */
  const addonLabel = (a: QuoteAddon) =>
    docSettings?.quoteAddonLabels?.[a.id]?.trim() || a.label;

  /* Pull finance defaults from the same settings source the rest of the app uses. */
  const effectiveRate = rate ?? settings?.default_interest_rate ?? FALLBACK_RATE;

  /* Balloon can be driven by either a % of price OR a typed rand amount —
     whichever field was edited last wins; the other is kept in sync. */
  const baseResidualPct = residual ?? settings?.default_balloon_percent ?? FALLBACK_RESIDUAL;
  const effectiveResidualAmount =
    balloonMode === 'amount' ? residualAmount ?? 0 : (baseResidualPct / 100) * vehiclePrice;
  const effectiveResidualPct =
    vehiclePrice > 0 ? (effectiveResidualAmount / vehiclePrice) * 100 : 0;

  const result = useMemo(
    () =>
      calcFinanceQuote({
        vehiclePrice,
        deposit,
        annualRatePct: effectiveRate,
        term,
        residualPct: effectiveResidualPct,
        bankDocFee,
        addons,
        covers,
      }),
    [vehiclePrice, deposit, effectiveRate, term, effectiveResidualPct, bankDocFee, addons, covers],
  );

  const depositPct = vehiclePrice > 0 ? (deposit / vehiclePrice) * 100 : 0;

  /* ── handlers ── */
  const updateAddon = (id: string, amount: number) =>
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, amount } : a)));

  const updateCover = (id: string, patch: Partial<QuoteCover>) =>
    setCovers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addCover = () =>
    setCovers((prev) => [...prev, { id: crypto.randomUUID(), label: '', amount: 0 }]);

  const removeCover = (id: string) => setCovers((prev) => prev.filter((c) => c.id !== id));

  /* ── add-on rename mode ── */
  const startEditLabels = () => {
    setLabelDraft(Object.fromEntries(addons.map((a) => [a.id, addonLabel(a)])));
    setEditingLabels(true);
    setAddonsOpen(true);
  };

  const cancelEditLabels = () => setEditingLabels(false);

  const saveLabels = () => {
    /* Only store labels that differ from the built-in default; an emptied input
       (or one typed back to the default) reverts that addon to its default. */
    const overrides: Record<string, string> = {};
    for (const a of addons) {
      const v = (labelDraft[a.id] ?? '').trim();
      if (v && v !== a.label) overrides[a.id] = v;
    }
    const base: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(docSettings || {}) };
    updateDocSettings.mutate(
      { ...base, quoteAddonLabels: overrides },
      { onSuccess: () => setEditingLabels(false) },
    );
  };

  const handleCopy = async () => {
    const activeAddons = addons.filter((a) => a.amount > 0);
    const activeCovers = covers.filter((c) => c.amount > 0);

    const msg = [
      '🚗 *Lumina Auto | Finance Quote*',
      '',
      `Vehicle Price: ${formatRand(vehiclePrice, 0)}`,
      deposit > 0 ? `Deposit: ${formatRand(deposit, 0)} (${depositPct.toFixed(1)}%)` : null,
      `Interest Rate: ${effectiveRate}%`,
      `Term: ${term} months`,
      effectiveResidualPct > 0
        ? `Residual/Balloon: ${effectiveResidualPct.toFixed(1)}% (${formatRand(effectiveResidualAmount, 0)})`
        : null,
      ...activeAddons.map((a) => `• ${addonLabel(a)}: ${formatRand(a.amount, 0)}`),
      ...(activeCovers.length > 0
        ? [
            '',
            'Monthly covers:',
            ...activeCovers.map((c) => `• ${c.label.trim() || 'Cover'}: ${formatRand(c.amount, 0)}`),
          ]
        : []),
      '',
      `💰 *Total payment / month: ${formatRand(result.totalPaymentPerMonth)}*`,
      '',
      'Let me know if you would like to proceed! 🤝',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      toast.success('Quote copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Quote Generator | Lumina Auto Admin</title>
      </Helmet>

      <PageHeader
        icon={<Calculator />}
        title="Quote Generator"
        subtitle="Finance installment calculator"
        actions={
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy quote
          </Button>
        }
      />

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
          {/* ═══════ INPUTS ═══════ */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Deal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Vehicle Price"
                  value={vehiclePrice}
                  onChange={setVehiclePrice}
                  prefix="R"
                />
                <NumberField
                  label="Deposit"
                  value={deposit}
                  onChange={setDeposit}
                  prefix="R"
                  hint={`${depositPct.toFixed(1)}% of vehicle price`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Interest Rate"
                  value={effectiveRate}
                  onChange={setRate}
                  suffix="%"
                  step={0.05}
                />
                <NumberField label="Term" value={term} onChange={setTerm} suffix="mo" step={6} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Residual / Balloon"
                  value={
                    balloonMode === 'amount'
                      ? Math.round(effectiveResidualPct * 100) / 100
                      : baseResidualPct
                  }
                  onChange={(v) => {
                    setResidual(v);
                    setBalloonMode('pct');
                  }}
                  suffix="%"
                  step={5}
                  hint="% of vehicle price"
                />
                <NumberField
                  label="Balloon amount"
                  value={
                    balloonMode === 'amount'
                      ? residualAmount ?? 0
                      : Math.round(effectiveResidualAmount)
                  }
                  onChange={(v) => {
                    setResidualAmount(v);
                    setBalloonMode('amount');
                  }}
                  prefix="R"
                  hint="or enter rand directly"
                />
              </div>

              <NumberField
                label="Bank Doc Fee"
                value={bankDocFee}
                onChange={setBankDocFee}
                prefix="R"
                hint="Spread evenly over the term"
              />

              {/* Add-ons (financed) */}
              <div className="border-t border-border pt-3">
                <Collapsible open={addonsOpen} onOpenChange={setAddonsOpen}>
                  <div className="flex items-center gap-1">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex-1 justify-between px-2 h-8">
                        <span className="text-xs font-medium">Add-ons (financed)</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${addonsOpen ? 'rotate-180' : ''}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Rename add-ons"
                      aria-label="Rename add-ons"
                      onClick={editingLabels ? cancelEditLabels : startEditLabels}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CollapsibleContent className="pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      {addons.map((a) =>
                        editingLabels ? (
                          <div key={a.id} className="space-y-1.5">
                            <Input
                              value={labelDraft[a.id] ?? ''}
                              onChange={(e) =>
                                setLabelDraft((d) => ({ ...d, [a.id]: e.target.value }))
                              }
                              placeholder={a.label}
                              className="h-7 text-xs"
                            />
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground font-medium w-4">
                                R
                              </span>
                              <Input
                                type="number"
                                value={a.amount || ''}
                                onChange={(e) => updateAddon(a.id, Number(e.target.value) || 0)}
                                className="font-mono h-8 text-sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <NumberField
                            key={a.id}
                            label={addonLabel(a)}
                            value={a.amount}
                            onChange={(v) => updateAddon(a.id, v)}
                            prefix="R"
                          />
                        ),
                      )}
                    </div>
                    {editingLabels && (
                      <div className="flex items-center justify-end gap-2 pt-3">
                        <p className="text-[11px] text-muted-foreground mr-auto">
                          Renames apply for all users. Clear a name to restore its default.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={cancelEditLabels}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs"
                          onClick={saveLabels}
                          disabled={updateDocSettings.isPending}
                        >
                          {updateDocSettings.isPending ? 'Saving…' : 'Save names'}
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>

          {/* ═══════ RESULTS + COVERS ═══════ */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <ResultRow label="Financed total" value={formatRand(result.financed)} muted />
                <Separator />
                <ResultRow label="Monthly payment (PMT)" value={formatRand(result.payment)} />
                <ResultRow
                  label="Bank doc fee / month"
                  value={formatRand(result.bankDocFeeMonthly)}
                  op="+"
                  muted
                />
                <ResultRow
                  label="Instalment subtotal"
                  value={formatRand(result.instalmentSubtotal)}
                  op="="
                />
                <ResultRow label="Covers" value={formatRand(result.coversTotal)} op="+" muted />

                <Separator />
                <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-500/10 px-3 py-2.5 mt-1">
                  <div>
                    <p className="text-sm font-semibold">Total payment / month</p>
                    <p className="text-[11px] text-muted-foreground">
                      Incl. doc fee &amp; monthly covers
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400 font-mono">
                    {formatRand(result.totalPaymentPerMonth)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Monthly covers */}
            <Card className="glass-card">
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Monthly covers</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addCover}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {covers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No covers added.</p>
                ) : (
                  covers.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Input
                        value={c.label}
                        onChange={(e) => updateCover(c.id, { label: e.target.value })}
                        placeholder="Cover name"
                        className="h-8 text-sm flex-1"
                      />
                      <div className="flex items-center gap-1.5 w-32">
                        <span className="text-xs text-muted-foreground">R</span>
                        <Input
                          type="number"
                          value={c.amount || ''}
                          onChange={(e) =>
                            updateCover(c.id, { amount: Number(e.target.value) || 0 })
                          }
                          className="font-mono h-8 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCover(c.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQuoteGenerator;
