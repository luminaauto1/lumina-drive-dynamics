import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Plus, X, Copy, Calculator, MessageSquare, Check } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/formatters';

interface QuoteOption {
  id: string;
  title: string;
  price: number;
  rate: number;
  term: number;
  deposit: number;
  balloon: number;
  installment: number;
}

// PMT Formula with balloon adjustment
const calculatePMT = (
  principal: number,
  annualRate: number,
  months: number,
  balloonAmount: number = 0
): number => {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) {
    return (principal - balloonAmount) / months;
  }
  
  const monthlyRate = annualRate / 100 / 12;
  const presentValueOfBalloon = balloonAmount / Math.pow(1 + monthlyRate, months);
  const adjustedPrincipal = principal - presentValueOfBalloon;
  
  const payment = adjustedPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  
  return Math.round(payment);
};

const AdminQuoteGenerator = () => {
  // Calculator State
  const [scenarioTitle, setScenarioTitle] = useState('Option 1');
  const [vehiclePrice, setVehiclePrice] = useState(250000);
  const [interestRate, setInterestRate] = useState(12);
  const [term, setTerm] = useState(72);
  
  // Deposit state (amount + percent synced)
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositPercent, setDepositPercent] = useState(0);
  
  // Balloon state (amount + percent synced)
  const [balloonPercent, setBalloonPercent] = useState(0);
  const [balloonAmount, setBalloonAmount] = useState(0);
  
  const [installment, setInstallment] = useState(0);
  
  // Quote Cart State
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [copied, setCopied] = useState(false);

  // Sync deposit amount when percent slider changes
  const handleDepositPercentChange = (percent: number) => {
    setDepositPercent(percent);
    const amount = Math.round(vehiclePrice * (percent / 100));
    setDepositAmount(amount);
  };

  // Sync deposit percent when amount input changes
  const handleDepositAmountChange = (amount: number) => {
    setDepositAmount(amount);
    if (vehiclePrice > 0) {
      const percent = Math.round((amount / vehiclePrice) * 100);
      setDepositPercent(Math.min(50, Math.max(0, percent)));
    }
  };

  // Sync balloon amount when percent slider changes
  const handleBalloonPercentChange = (percent: number) => {
    setBalloonPercent(percent);
    const amount = Math.round(vehiclePrice * (percent / 100));
    setBalloonAmount(amount);
  };

  // Sync balloon percent when amount input changes
  const handleBalloonAmountChange = (amount: number) => {
    setBalloonAmount(amount);
    if (vehiclePrice > 0) {
      const percent = Math.round((amount / vehiclePrice) * 100);
      setBalloonPercent(Math.min(75, Math.max(0, percent)));
    }
  };

  // Recalculate deposit/balloon amounts when vehicle price changes
  useEffect(() => {
    setDepositAmount(Math.round(vehiclePrice * (depositPercent / 100)));
    setBalloonAmount(Math.round(vehiclePrice * (balloonPercent / 100)));
  }, [vehiclePrice]);

  // Calculate installment when inputs change
  useEffect(() => {
    const principal = vehiclePrice - depositAmount;
    const balloon = vehiclePrice * (balloonPercent / 100);
    const pmt = calculatePMT(principal, interestRate, term, balloon);
    setInstallment(pmt);
  }, [vehiclePrice, interestRate, term, depositAmount, balloonPercent]);

  // Add option to cart
  const handleAddOption = () => {
    if (!scenarioTitle.trim()) {
      toast.error('Please enter a scenario title');
      return;
    }

    const newOption: QuoteOption = {
      id: crypto.randomUUID(),
      title: scenarioTitle,
      price: vehiclePrice,
      rate: interestRate,
      term: term,
      deposit: depositAmount,
      balloon: balloonPercent,
      installment: installment,
    };

    setQuoteOptions([...quoteOptions, newOption]);
    
    // Increment title number for convenience
    const match = scenarioTitle.match(/Option (\d+)/);
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      setScenarioTitle(`Option ${nextNum}`);
    } else {
      setScenarioTitle('');
    }
    
    toast.success('Option added to quote');
  };

  // Remove option from cart
  const handleRemoveOption = (id: string) => {
    setQuoteOptions(quoteOptions.filter(opt => opt.id !== id));
  };

  // Generate WhatsApp message and copy to clipboard
  const handleCopyWhatsApp = async () => {
    if (quoteOptions.length === 0) {
      toast.error('Add at least one option first');
      return;
    }

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    let message = `🚗 *Lumina Auto | Finance Options*\n\n`;
    message += `Here are the payment plans we calculated for you:\n\n`;

    quoteOptions.forEach((opt, index) => {
      const emoji = numberEmojis[index] || `${index + 1}.`;
      message += `*${emoji} ${opt.title}*\n`;
      message += `📅 Term: ${opt.term} Months\n`;
      message += `📉 Deposit: R ${opt.deposit.toLocaleString()}\n`;
      message += `🎈 Balloon: ${opt.balloon}%\n`;
      message += `⚡ *Installment: R ${opt.installment.toLocaleString()} p/m*\n\n`;
    });

    message += `Let me know which option works best for your budget! 🤝`;

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('WhatsApp message copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Quote Generator | Lumina Auto Admin</title>
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">WhatsApp Quote Generator</h1>
            <p className="text-muted-foreground">Build multi-scenario finance quotes for clients</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Calculator */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Finance Calculator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scenario Title */}
                <div className="space-y-2">
                  <Label>Scenario Title</Label>
                  <Input
                    value={scenarioTitle}
                    onChange={(e) => setScenarioTitle(e.target.value)}
                    placeholder="e.g., Option 1: No Deposit"
                  />
                </div>

                {/* Vehicle Price (hidden in output) */}
                <div className="space-y-2">
                  <Label>Vehicle Price (for calculation only)</Label>
                  <Input
                    type="number"
                    value={vehiclePrice}
                    onChange={(e) => setVehiclePrice(Number(e.target.value))}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">This value is NOT shown in the WhatsApp message</p>
                </div>

                {/* Interest Rate - Smart Input */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Interest Rate</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={interestRate}
                      onChange={(e) => {
                        const val = Math.min(25, Math.max(7, Number(e.target.value)));
                        setInterestRate(val);
                      }}
                      className="font-mono w-24"
                      step={0.25}
                      min={7}
                      max={25}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <Slider
                    value={[interestRate]}
                    onValueChange={(v) => setInterestRate(v[0])}
                    min={7}
                    max={25}
                    step={0.25}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>7%</span>
                    <span>25%</span>
                  </div>
                </div>

                {/* Term - Smart Input */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Term (Months)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={term}
                      onChange={(e) => {
                        const val = Math.min(96, Math.max(12, Math.round(Number(e.target.value) / 12) * 12));
                        setTerm(val);
                      }}
                      className="font-mono w-24"
                      step={12}
                      min={12}
                      max={96}
                    />
                    <span className="text-muted-foreground">months</span>
                  </div>
                  <Slider
                    value={[term]}
                    onValueChange={(v) => setTerm(v[0])}
                    min={12}
                    max={96}
                    step={12}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>12</span>
                    <span>24</span>
                    <span>36</span>
                    <span>48</span>
                    <span>60</span>
                    <span>72</span>
                    <span>84</span>
                    <span>96</span>
                  </div>
                </div>

                {/* Deposit - Smart Input */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Deposit</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">R</span>
                    <Input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => handleDepositAmountChange(Number(e.target.value))}
                      className="font-mono flex-1"
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">{depositPercent}%</span>
                  </div>
                  <Slider
                    value={[depositPercent]}
                    onValueChange={(v) => handleDepositPercentChange(v[0])}
                    min={0}
                    max={50}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>

                {/* Balloon - Smart Input */}
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Label className="font-semibold">Balloon Payment</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">R</span>
                    <Input
                      type="number"
                      value={balloonAmount}
                      onChange={(e) => handleBalloonAmountChange(Number(e.target.value))}
                      className="font-mono flex-1"
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">{balloonPercent}%</span>
                  </div>
                  <Slider
                    value={[balloonPercent]}
                    onValueChange={(v) => handleBalloonPercentChange(v[0])}
                    min={0}
                    max={75}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                  </div>
                </div>

                {/* Live Installment Display */}
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Estimated Monthly Payment</p>
                  <p className="text-3xl font-bold text-primary">{formatPrice(installment)}</p>
                  <p className="text-xs text-muted-foreground mt-1">per month</p>
                </div>

                {/* Add Button */}
                <Button onClick={handleAddOption} className="w-full" size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Add This Option
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column: Staging Area */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quote Options ({quoteOptions.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quoteOptions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No options added yet</p>
                    <p className="text-sm">Use the calculator to add finance scenarios</p>
                  </div>
                ) : (
                  <>
                    {quoteOptions.map((opt, index) => (
                      <motion.div
                        key={opt.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-lg border border-border bg-card relative group"
                      >
                        <button
                          onClick={() => handleRemoveOption(opt.id)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        
                        <p className="font-semibold mb-2">{index + 1}. {opt.title}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p className="text-muted-foreground">Term:</p>
                          <p>{opt.term} months</p>
                          <p className="text-muted-foreground">Deposit:</p>
                          <p>{formatPrice(opt.deposit)}</p>
                          <p className="text-muted-foreground">Balloon:</p>
                          <p>{opt.balloon}%</p>
                          <p className="text-muted-foreground">Installment:</p>
                          <p className="font-semibold text-primary">{formatPrice(opt.installment)} p/m</p>
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Copy Button */}
            <Button
              onClick={handleCopyWhatsApp}
              disabled={quoteOptions.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 mr-2" />
                  Copy WhatsApp Message
                </>
              )}
            </Button>

            {/* Preview Card */}
            {quoteOptions.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm">Message Preview</CardTitle>
                </CardHeader>
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
