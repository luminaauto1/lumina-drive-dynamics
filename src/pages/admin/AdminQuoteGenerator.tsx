import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Plus, X, Copy, Calculator, MessageSquare, Check, Printer, Eye } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/formatters';

/* ───────── types ───────── */
interface Inputs {
  price: number;
  deposit: number;
  rate: number;
  term: number;
  balloon: number;
  initiationFee: number;
  monthlyFee: number;
  licenseFee: number;
  adminFee: number;
  warranty: number;
}

interface Visibility {
  price: boolean;
  deposit: boolean;
  rate: boolean;
  term: boolean;
  balloon: boolean;
  initiationFee: boolean;
  monthlyFee: boolean;
  licenseFee: boolean;
  adminFee: boolean;
  warranty: boolean;
  totalFinanced: boolean;
}

interface CalcResult {
  installment: number;
  totalFinanced: number;
  balloonAmount: number;
  extrasTotal: number;
}

interface QuoteOption {
  id: string;
  title: string;
  inputs: Inputs;
  show: Visibility;
  result: CalcResult;
}

/* ───────── helpers ───────── */
const calculatePMT = (principal: number, annualRate: number, months: number, balloonAmount: number = 0): number => {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return (principal - balloonAmount) / months;
  const r = annualRate / 100 / 12;
  const pvBalloon = balloonAmount / Math.pow(1 + r, months);
  const adjusted = principal - pvBalloon;
  return Math.round(adjusted * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
};

/* ───────── defaults ───────── */
const DEFAULT_INPUTS: Inputs = {
  price: 300000,
  deposit: 0,
  rate: 13.25,
  term: 72,
  balloon: 35,
  initiationFee: 1207.50,
  monthlyFee: 69,
  licenseFee: 2500,
  adminFee: 4500,
  warranty: 0,
};

const DEFAULT_VISIBILITY: Visibility = {
  price: true,
  deposit: true,
  rate: true,
  term: true,
  balloon: true,
  initiationFee: false,
  monthlyFee: false,
  licenseFee: false,
  adminFee: false,
  warranty: false,
  totalFinanced: false,
};

/* ───────── component ───────── */
const AdminQuoteGenerator = () => {
  const [inputs, setInputs] = useState<Inputs>({ ...DEFAULT_INPUTS });
  const [show, setShow] = useState<Visibility>({ ...DEFAULT_VISIBILITY });
  const [scenarioTitle, setScenarioTitle] = useState('Option 1');
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [copied, setCopied] = useState(false);

  /* ── derived calculation (always uses ALL values) ── */
  const extras = inputs.licenseFee + inputs.adminFee + inputs.warranty + inputs.initiationFee;
  const totalFinanced = Math.max(0, inputs.price + extras - inputs.deposit);
  const balloonAmount = Math.round(inputs.price * (inputs.balloon / 100));
  const basePmt = calculatePMT(totalFinanced, inputs.rate, inputs.term, balloonAmount);
  const installment = basePmt + inputs.monthlyFee;

  const result: CalcResult = { installment, totalFinanced, balloonAmount, extrasTotal: extras };

  /* ── helpers ── */
  const updateInput = (key: keyof Inputs, val: number) => setInputs(prev => ({ ...prev, [key]: val }));
  const toggleShow = (key: keyof Visibility, val: boolean) => setShow(prev => ({ ...prev, [key]: val }));

  /* ── input row with checkbox ── */
  const ControlRow = ({ label, field, prefix, suffix, min, max, step, slider }: {
    label: string; field: keyof Inputs; prefix?: string; suffix?: string;
    min?: number; max?: number; step?: number; slider?: boolean;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={show[field as keyof Visibility]}
                  onCheckedChange={(c) => toggleShow(field as keyof Visibility, !!c)}
                  className="h-3.5 w-3.5"
                />
                <Eye className="h-3 w-3 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">Check to show on client quote</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Label className="text-xs font-medium">{label}</Label>
      </div>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-xs text-muted-foreground font-medium">{prefix}</span>}
        <Input
          type="number"
          value={inputs[field] || ''}
          onChange={e => updateInput(field, Number(e.target.value) || 0)}
          className="font-mono h-8 text-sm"
          min={min}
          max={max}
          step={step}
        />
        {suffix && <span className="text-xs text-muted-foreground w-8 text-right">{suffix}</span>}
      </div>
      {slider && min !== undefined && max !== undefined && (
        <Slider
          value={[inputs[field]]}
          onValueChange={v => updateInput(field, v[0])}
          min={min}
          max={max}
          step={step || 1}
          className="mt-1"
        />
      )}
    </div>
  );

  /* ── add option ── */
  const handleAddOption = () => {
    if (!scenarioTitle.trim()) { toast.error('Enter a scenario title'); return; }
    const opt: QuoteOption = {
      id: crypto.randomUUID(),
      title: scenarioTitle,
      inputs: { ...inputs },
      show: { ...show },
      result: { ...result },
    };
    setQuoteOptions(prev => [...prev, opt]);
    const match = scenarioTitle.match(/Option (\d+)/);
    setScenarioTitle(match ? `Option ${parseInt(match[1]) + 1}` : '');
    toast.success('Option added');
  };

  /* ── copy whatsapp ── */
  const handleCopyWhatsApp = async () => {
    if (quoteOptions.length === 0) { toast.error('Add at least one option first'); return; }
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    let msg = `🚗 *Lumina Auto | Finance Options*\n\nHere are the payment plans we calculated for you:\n\n`;
    quoteOptions.forEach((opt, i) => {
      msg += `*${emojis[i] || `${i + 1}.`} ${opt.title}*\n`;
      if (opt.show.term) msg += `📅 Term: ${opt.inputs.term} Months\n`;
      if (opt.show.deposit && opt.inputs.deposit > 0) msg += `📉 Deposit: R ${opt.inputs.deposit.toLocaleString()}\n`;
      if (opt.show.balloon && opt.inputs.balloon > 0) msg += `🎈 Balloon: ${opt.inputs.balloon}%\n`;
      msg += `⚡ *Installment: R ${opt.result.installment.toLocaleString()} p/m*\n\n`;
    });
    msg += `Let me know which option works best for your budget! 🤝`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true); toast.success('WhatsApp message copied!'); setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  /* ── quote card renderer ── */
  const QuoteCard = ({ opt }: { opt: { inputs: Inputs; show: Visibility; result: CalcResult; title?: string } }) => {
    const { inputs: inp, show: vis, result: res } = opt;
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-border bg-muted/30">
          <div>
            <h3 className="text-lg font-display font-bold">Finance Quote</h3>
            <p className="text-xs text-muted-foreground">Prepared exclusively for you</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">Lumina Auto</p>
            <p className="text-xs text-muted-foreground">Premium Pre-Owned</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="p-5 space-y-3">
          {vis.price && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vehicle Price</span>
              <span className="font-mono font-medium">R {inp.price.toLocaleString()}</span>
            </div>
          )}

          {/* Extras */}
          {vis.adminFee && inp.adminFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Admin Fee</span>
              <span className="font-mono text-muted-foreground">+ R {inp.adminFee.toLocaleString()}</span>
            </div>
          )}
          {vis.licenseFee && inp.licenseFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">License & Registration</span>
              <span className="font-mono text-muted-foreground">+ R {inp.licenseFee.toLocaleString()}</span>
            </div>
          )}
          {vis.warranty && inp.warranty > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Warranty / VAPs</span>
              <span className="font-mono text-muted-foreground">+ R {inp.warranty.toLocaleString()}</span>
            </div>
          )}
          {vis.initiationFee && inp.initiationFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bank Initiation</span>
              <span className="font-mono text-muted-foreground">+ R {inp.initiationFee.toLocaleString()}</span>
            </div>
          )}

          {/* Deposit */}
          {vis.deposit && inp.deposit > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Less: Deposit</span>
              <span className="font-mono text-green-600">- R {inp.deposit.toLocaleString()}</span>
            </div>
          )}

          {/* Total Financed */}
          {vis.totalFinanced && (
            <>
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Financed</span>
                <span className="font-mono">R {res.totalFinanced.toLocaleString()}</span>
              </div>
            </>
          )}

          {/* Terms row */}
          {(vis.term || vis.rate || vis.balloon) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
              {vis.term && <span>Term: <strong>{inp.term} Months</strong></span>}
              {vis.rate && <span>Rate: <strong>{inp.rate}%</strong></span>}
              {vis.balloon && inp.balloon > 0 && <span>Balloon: <strong>{inp.balloon}%</strong></span>}
            </div>
          )}
        </div>

        {/* Footer: Installment */}
        <div className="p-5 bg-primary/10 border-t border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Installment</p>
              <p className="text-xs text-muted-foreground">*Includes monthly service fees</p>
            </div>
            <p className="text-3xl font-bold text-primary font-mono">
              R {res.installment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <Helmet><title>Quote Generator | Lumina Auto Admin</title></Helmet>
      <div className="p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><MessageSquare className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-display font-bold">WhatsApp Quote Generator</h1>
            <p className="text-muted-foreground text-sm">Build multi-scenario finance quotes · <Eye className="inline h-3 w-3" /> = visible on client quote</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ═══════ LEFT: CONTROLS ═══════ */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* Scenario title */}
            <Card className="glass-card">
              <CardContent className="pt-5 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Scenario Title</Label>
                  <Input value={scenarioTitle} onChange={e => setScenarioTitle(e.target.value)} placeholder="e.g., Option 1: No Deposit" className="h-8 text-sm" />
                </div>
              </CardContent>
            </Card>

            {/* Vehicle & Deal */}
            <Card className="glass-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Vehicle & Deal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ControlRow label="Vehicle Price" field="price" prefix="R" />
                <ControlRow label="Deposit" field="deposit" prefix="R" min={0} max={inputs.price * 0.5} step={5000} slider />
                <ControlRow label="Interest Rate" field="rate" suffix="%" min={7} max={25} step={0.25} slider />
                <ControlRow label="Term (Months)" field="term" suffix="mo" min={12} max={96} step={12} slider />
                <ControlRow label="Balloon %" field="balloon" suffix="%" min={0} max={75} step={5} slider />
              </CardContent>
            </Card>

            {/* Fees & Extras */}
            <Card className="glass-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Fees & Extras</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ControlRow label="Admin Fee" field="adminFee" prefix="R" />
                  <ControlRow label="License & Reg" field="licenseFee" prefix="R" />
                  <ControlRow label="Warranty / VAPs" field="warranty" prefix="R" />
                  <ControlRow label="Bank Initiation" field="initiationFee" prefix="R" />
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ControlRow label="Monthly Service Fee" field="monthlyFee" prefix="R" />
                </div>
                <Separator />
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    checked={show.totalFinanced}
                    onCheckedChange={c => toggleShow('totalFinanced', !!c)}
                    className="h-3.5 w-3.5"
                  />
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-xs">Show "Total Financed Amount" line</Label>
                </div>
              </CardContent>
            </Card>

            {/* Add button */}
            <Button onClick={handleAddOption} className="w-full" size="lg">
              <Plus className="h-4 w-4 mr-2" />Add This Option
            </Button>
          </motion.div>

          {/* ═══════ RIGHT: QUOTE PREVIEW + STAGING ═══════ */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* Live preview */}
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Live Preview</CardTitle></CardHeader>
              <CardContent>
                <QuoteCard opt={{ inputs, show, result, title: scenarioTitle }} />
              </CardContent>
            </Card>

            {/* Staged options */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-sm">Staged Options ({quoteOptions.length})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {quoteOptions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No options staged yet</p>
                  </div>
                ) : quoteOptions.map((opt, i) => (
                  <motion.div key={opt.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative group">
                    <button onClick={() => setQuoteOptions(prev => prev.filter(o => o.id !== opt.id))} className="absolute top-2 right-2 z-10 p-1 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-xs font-semibold mb-1 px-1">{i + 1}. {opt.title}</p>
                    <QuoteCard opt={opt} />
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Button onClick={handleCopyWhatsApp} disabled={quoteOptions.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
              {copied ? <><Check className="h-5 w-5 mr-2" />Copied!</> : <><Copy className="h-5 w-5 mr-2" />Copy WhatsApp Message</>}
            </Button>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQuoteGenerator;
