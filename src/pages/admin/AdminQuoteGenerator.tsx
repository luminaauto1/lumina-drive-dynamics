import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Plus, X, Copy, Calculator, MessageSquare, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/formatters';

interface QuoteExtra {
  licenseReg: number;
  dealerAdmin: number;
  warranty: number;
  servicePlan: number;
  scratchDent: number;
  smashGrab: number;
  creditLife: number;
  topUpCover: number;
}

interface QuoteOption {
  id: string;
  title: string;
  price: number;
  extras: QuoteExtra;
  extrasTotal: number;
  rate: number;
  term: number;
  deposit: number;
  balloon: number;
  totalFinanced: number;
  installment: number;
  initiationFee: number;
  monthlyFee: number;
}

const DEFAULT_EXTRAS: QuoteExtra = {
  licenseReg: 0,
  dealerAdmin: 0,
  warranty: 0,
  servicePlan: 0,
  scratchDent: 0,
  smashGrab: 0,
  creditLife: 0,
  topUpCover: 0,
};

const EXTRAS_LABELS: Record<keyof QuoteExtra, string> = {
  licenseReg: 'License & Registration',
  dealerAdmin: 'Dealer Admin Fee',
  warranty: 'Warranty / Mechanical Breakdown',
  servicePlan: 'Service / Maintenance Plan',
  scratchDent: 'Scratch & Dent Repair',
  smashGrab: 'Smash & Grab',
  creditLife: 'Credit Life Insurance',
  topUpCover: 'Top-Up / Shortfall Cover',
};

const calculatePMT = (principal: number, annualRate: number, months: number, balloonAmount: number = 0): number => {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return (principal - balloonAmount) / months;
  const monthlyRate = annualRate / 100 / 12;
  const pvBalloon = balloonAmount / Math.pow(1 + monthlyRate, months);
  const adjusted = principal - pvBalloon;
  return Math.round(adjusted * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
};

const AdminQuoteGenerator = () => {
  const [scenarioTitle, setScenarioTitle] = useState('Option 1');
  const [vehiclePrice, setVehiclePrice] = useState(250000);
  const [interestRate, setInterestRate] = useState(12);
  const [term, setTerm] = useState(72);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositPercent, setDepositPercent] = useState(0);
  const [balloonPercent, setBalloonPercent] = useState(0);
  const [balloonAmount, setBalloonAmount] = useState(0);
  const [extras, setExtras] = useState<QuoteExtra>({ ...DEFAULT_EXTRAS });
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Bank Fees
  const [initiationFee, setInitiationFee] = useState(1207.50);
  const [monthlyFee, setMonthlyFee] = useState(69);

  const extrasTotal = Object.values(extras).reduce((s, v) => s + v, 0);
  const totalFinanced = Math.max(0, vehiclePrice + extrasTotal + initiationFee - depositAmount);
  const balloonValue = Math.round(vehiclePrice * (balloonPercent / 100));
  const baseInstallment = calculatePMT(totalFinanced, interestRate, term, balloonValue);
  const installment = baseInstallment + monthlyFee;

  const handleDepositPercentChange = (p: number) => { setDepositPercent(p); setDepositAmount(Math.round(vehiclePrice * (p / 100))); };
  const handleDepositAmountChange = (a: number) => { setDepositAmount(a); if (vehiclePrice > 0) setDepositPercent(Math.min(50, Math.max(0, Math.round((a / vehiclePrice) * 100)))); };
  const handleBalloonPercentChange = (p: number) => { setBalloonPercent(p); setBalloonAmount(Math.round(vehiclePrice * (p / 100))); };
  const handleBalloonAmountChange = (a: number) => { setBalloonAmount(a); if (vehiclePrice > 0) setBalloonPercent(Math.min(75, Math.max(0, Math.round((a / vehiclePrice) * 100)))); };

  useEffect(() => {
    setDepositAmount(Math.round(vehiclePrice * (depositPercent / 100)));
    setBalloonAmount(Math.round(vehiclePrice * (balloonPercent / 100)));
  }, [vehiclePrice]);

  const updateExtra = (key: keyof QuoteExtra, value: number) => setExtras(prev => ({ ...prev, [key]: value }));

  const handleAddOption = () => {
    if (!scenarioTitle.trim()) { toast.error('Please enter a scenario title'); return; }
    const opt: QuoteOption = {
      id: crypto.randomUUID(), title: scenarioTitle, price: vehiclePrice,
      extras: { ...extras }, extrasTotal, rate: interestRate, term, deposit: depositAmount,
      balloon: balloonPercent, totalFinanced, installment, initiationFee, monthlyFee,
    };
    setQuoteOptions([...quoteOptions, opt]);
    const match = scenarioTitle.match(/Option (\d+)/);
    setScenarioTitle(match ? `Option ${parseInt(match[1]) + 1}` : '');
    toast.success('Option added to quote');
  };

  const handleCopyWhatsApp = async () => {
    if (quoteOptions.length === 0) { toast.error('Add at least one option first'); return; }
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    let msg = `🚗 *Lumina Auto | Finance Options*\n\nHere are the payment plans we calculated for you:\n\n`;
    quoteOptions.forEach((opt, i) => {
      msg += `*${emojis[i] || `${i + 1}.`} ${opt.title}*\n`;
      msg += `📅 Term: ${opt.term} Months\n`;
      if (opt.deposit > 0) msg += `📉 Deposit: R ${opt.deposit.toLocaleString()}\n`;
      if (opt.balloon > 0) msg += `🎈 Balloon: ${opt.balloon}%\n`;
      msg += `⚡ *Installment: R ${opt.installment.toLocaleString()} p/m*\n\n`;
    });
    msg += `Let me know which option works best for your budget! 🤝`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true); toast.success('WhatsApp message copied!'); setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  return (
    <AdminLayout>
      <Helmet><title>Quote Generator | Lumina Auto Admin</title></Helmet>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><MessageSquare className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-display font-bold">WhatsApp Quote Generator</h1>
            <p className="text-muted-foreground">Build multi-scenario finance quotes for clients</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Calculator */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <Card className="glass-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Finance Calculator</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Scenario Title</Label>
                  <Input value={scenarioTitle} onChange={e => setScenarioTitle(e.target.value)} placeholder="e.g., Option 1: No Deposit" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Price (for calculation only)</Label>
                  <Input type="number" value={vehiclePrice} onChange={e => setVehiclePrice(Number(e.target.value))} className="font-mono" />
                  <p className="text-xs text-muted-foreground">This value is NOT shown in the WhatsApp message</p>
                </div>

                {/* Interest Rate */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Interest Rate</Label>
                  <div className="flex items-center gap-3">
                    <Input type="number" value={interestRate} onChange={e => setInterestRate(Math.min(25, Math.max(7, Number(e.target.value))))} className="font-mono w-24" step={0.25} min={7} max={25} />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <Slider value={[interestRate]} onValueChange={v => setInterestRate(v[0])} min={7} max={25} step={0.25} />
                  <div className="flex justify-between text-xs text-muted-foreground"><span>7%</span><span>25%</span></div>
                </div>

                {/* Term */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Term (Months)</Label>
                  <div className="flex items-center gap-3">
                    <Input type="number" value={term} onChange={e => setTerm(Math.min(96, Math.max(12, Math.round(Number(e.target.value) / 12) * 12)))} className="font-mono w-24" step={12} min={12} max={96} />
                    <span className="text-muted-foreground">months</span>
                  </div>
                  <Slider value={[term]} onValueChange={v => setTerm(v[0])} min={12} max={96} step={12} />
                  <div className="flex justify-between text-xs text-muted-foreground">{[12,24,36,48,60,72,84,96].map(n => <span key={n}>{n}</span>)}</div>
                </div>

                {/* Deposit */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Deposit</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">R</span>
                    <Input type="number" value={depositAmount} onChange={e => handleDepositAmountChange(Number(e.target.value))} className="font-mono flex-1" placeholder="0" />
                    <span className="text-sm text-muted-foreground w-12 text-right">{depositPercent}%</span>
                  </div>
                  <Slider value={[depositPercent]} onValueChange={v => handleDepositPercentChange(v[0])} min={0} max={50} step={5} />
                  <div className="flex justify-between text-xs text-muted-foreground"><span>0%</span><span>25%</span><span>50%</span></div>
                </div>

                {/* Balloon */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Balloon Payment</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">R</span>
                    <Input type="number" value={balloonAmount} onChange={e => handleBalloonAmountChange(Number(e.target.value))} className="font-mono flex-1" placeholder="0" />
                    <span className="text-sm text-muted-foreground w-12 text-right">{balloonPercent}%</span>
                  </div>
                  <Slider value={[balloonPercent]} onValueChange={v => handleBalloonPercentChange(v[0])} min={0} max={75} step={5} />
                  <div className="flex justify-between text-xs text-muted-foreground"><span>0%</span><span>25%</span><span>50%</span><span>75%</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Fees */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Bank Fees</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Initiation Fee (added to principal)</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input type="number" value={initiationFee} onChange={e => setInitiationFee(Number(e.target.value) || 0)} className="font-mono h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Service Fee (added to PMT)</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input type="number" value={monthlyFee} onChange={e => setMonthlyFee(Number(e.target.value) || 0)} className="font-mono h-9 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add-Ons & Fees (Collapsible) */}
            <Card className="glass-card">
              <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>Add-Ons & Fees {extrasTotal > 0 && <span className="text-sm font-normal text-muted-foreground ml-2">({formatPrice(extrasTotal)})</span>}</span>
                      {extrasOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0">
                    {(Object.keys(EXTRAS_LABELS) as (keyof QuoteExtra)[]).map(key => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{EXTRAS_LABELS[key]}</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">R</span>
                          <Input type="number" value={extras[key] || ''} onChange={e => updateExtra(key, Number(e.target.value) || 0)} className="font-mono h-9 text-sm" placeholder="0" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Summary Table */}
            <Card className="glass-card">
              <CardContent className="pt-6">
                {/* Toggle for itemized breakdown */}
                <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/30">
                  <Label className="text-sm">Show Itemized Breakdown</Label>
                  <Switch checked={showBreakdown} onCheckedChange={setShowBreakdown} />
                </div>
                <Table>
                  <TableBody>
                    <TableRow><TableCell className="text-muted-foreground">Vehicle Price</TableCell><TableCell className="text-right font-mono">{formatPrice(vehiclePrice)}</TableCell></TableRow>
                    {showBreakdown && extrasTotal > 0 && <TableRow><TableCell className="text-muted-foreground">+ Add-Ons & Fees</TableCell><TableCell className="text-right font-mono">{formatPrice(extrasTotal)}</TableCell></TableRow>}
                    {showBreakdown && initiationFee > 0 && <TableRow><TableCell className="text-muted-foreground">+ Bank Initiation</TableCell><TableCell className="text-right font-mono">{formatPrice(initiationFee)}</TableCell></TableRow>}
                    {depositAmount > 0 && <TableRow><TableCell className="text-muted-foreground">Less: Deposit</TableCell><TableCell className="text-right font-mono">-{formatPrice(depositAmount)}</TableCell></TableRow>}
                    {showBreakdown && <TableRow><TableCell className="text-muted-foreground font-semibold">Total Financed</TableCell><TableCell className="text-right font-mono font-semibold">{formatPrice(totalFinanced)}</TableCell></TableRow>}
                    <TableRow><TableCell className="text-muted-foreground">Term / Rate</TableCell><TableCell className="text-right font-mono">{term} Months @ {interestRate}%</TableCell></TableRow>
                    {balloonPercent > 0 && <TableRow><TableCell className="text-muted-foreground">Balloon</TableCell><TableCell className="text-right font-mono">{balloonPercent}%</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Monthly Installment</p>
                  <p className="text-3xl font-bold text-primary">{formatPrice(installment)}</p>
                  <p className="text-xs text-muted-foreground mt-1">*Includes R{monthlyFee} service fee. T&Cs apply.</p>
                </div>
                <Button onClick={handleAddOption} className="w-full mt-4" size="lg"><Plus className="h-4 w-4 mr-2" />Add This Option</Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT: Staging */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <Card className="glass-card">
              <CardHeader><CardTitle>Quote Options ({quoteOptions.length})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {quoteOptions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No options added yet</p>
                    <p className="text-sm">Use the calculator to add finance scenarios</p>
                  </div>
                ) : quoteOptions.map((opt, index) => (
                  <motion.div key={opt.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-lg border border-border bg-card relative group">
                    <button onClick={() => setQuoteOptions(quoteOptions.filter(o => o.id !== opt.id))} className="absolute top-2 right-2 p-1 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                    <p className="font-semibold mb-2">{index + 1}. {opt.title}</p>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <p className="text-muted-foreground">Term:</p><p>{opt.term} months</p>
                      <p className="text-muted-foreground">Deposit:</p><p>{formatPrice(opt.deposit)}</p>
                      <p className="text-muted-foreground">Balloon:</p><p>{opt.balloon}%</p>
                      {opt.extrasTotal > 0 && <><p className="text-muted-foreground">Add-Ons:</p><p>{formatPrice(opt.extrasTotal)}</p></>}
                      <p className="text-muted-foreground">Total Financed:</p><p>{formatPrice(opt.totalFinanced)}</p>
                      <p className="text-muted-foreground">Installment:</p><p className="font-semibold text-primary">{formatPrice(opt.installment)} p/m</p>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={handleCopyWhatsApp} disabled={quoteOptions.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
              {copied ? <><Check className="h-5 w-5 mr-2" />Copied!</> : <><Copy className="h-5 w-5 mr-2" />Copy WhatsApp Message</>}
            </Button>

            {quoteOptions.length > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Message Preview</CardTitle></CardHeader>
                <CardContent>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap font-mono text-xs">
                    🚗 *Lumina Auto | Finance Options*{'\n\n'}
                    Here are the payment plans we calculated for you:{'\n\n'}
                    {quoteOptions.map((opt, i) => (
                      <span key={opt.id}>
                        *{i + 1}️⃣ {opt.title}*{'\n'}
                        📅 Term: {opt.term} Months{'\n'}
                        📉 Deposit: R {opt.deposit.toLocaleString()}{'\n'}
                        🎈 Balloon: {opt.balloon}%{'\n'}
                        {opt.extrasTotal > 0 ? `📋 Add-Ons & Fees: R ${opt.extrasTotal.toLocaleString()}\n` : ''}
                        ⚡ *Installment: R {opt.installment.toLocaleString()} p/m*{'\n\n'}
                      </span>
                    ))}
                    Let me know which option works best for your budget! 🤝
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQuoteGenerator;
