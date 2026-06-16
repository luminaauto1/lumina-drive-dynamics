import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Calculator as CalculatorIcon, Info, MessageCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import KineticText from '@/components/KineticText';
import { formatPrice } from '@/lib/formatters';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Calculator = () => {
  const { data: settings } = useSiteSettings();
  const whatsappNumber = settings?.whatsapp_number || '27686017462';
  
  // Dynamic settings from database
  const minInterest = settings?.min_interest ?? 10.5;
  const maxInterest = settings?.max_interest ?? 25;
  const defaultInterest = settings?.default_interest_rate ?? 13.5;

  const [vehiclePrice, setVehiclePrice] = useState<number | ''>(500000);
  const [vehicleYear, setVehicleYear] = useState(new Date().getFullYear());
  const [deposit, setDeposit] = useState(0); // Default deposit to 0%
  const [balloon, setBalloon] = useState(0);
  const [months, setMonths] = useState(72);
  const [interest, setInterest] = useState<number | ''>(defaultInterest);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  // Lead-capture ("WhatsApp me this estimate") state
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadWebsite, setLeadWebsite] = useState(''); // honeypot — must stay empty
  const [isSendingEstimate, setIsSendingEstimate] = useState(false);

  // Update interest when settings load
  useEffect(() => {
    if (settings?.default_interest_rate) {
      setInterest(settings.default_interest_rate);
    }
  }, [settings?.default_interest_rate]);

  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleYear;
  const maxBalloon = Math.max(0, 40 - vehicleAge * 5);

  // Clamp balloon down if the vehicle age lowers the cap. The inline note under
  // the balloon slider explains the bank age-based limit to the user.
  useEffect(() => {
    if (balloon > maxBalloon) setBalloon(maxBalloon);
  }, [maxBalloon, balloon]);

  // PMT formula calculation
  useEffect(() => {
    const priceValue = vehiclePrice === '' ? 0 : vehiclePrice;
    const interestValue = interest === '' ? 0 : interest;
    
    const depositAmount = priceValue * (deposit / 100);
    const balloonAmount = priceValue * (balloon / 100);
    const principal = priceValue - depositAmount;
    const monthlyRate = interestValue / 100 / 12;

    if (monthlyRate === 0) {
      setMonthlyPayment(Math.round((principal - balloonAmount) / months));
      return;
    }

    const pvMinusFv = principal - balloonAmount / Math.pow(1 + monthlyRate, months);
    const payment = (pvMinusFv * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

    setMonthlyPayment(Math.round(payment));
  }, [vehiclePrice, deposit, balloon, months, interest]);

  const priceValue = vehiclePrice === '' ? 0 : vehiclePrice;
  const depositAmount = priceValue * (deposit / 100);
  const balloonAmount = priceValue * (balloon / 100);
  const financeAmount = priceValue - depositAmount;

  const yearOptions = Array.from({ length: 15 }, (_, i) => currentYear - i);

  // "WhatsApp me this estimate" — capture a high-intent lead (best effort) and
  // open WhatsApp prefilled with the computed estimate so it isn't lost.
  const handleSendEstimate = async () => {
    if (leadWebsite.trim().length > 0) return; // honeypot tripped
    setIsSendingEstimate(true);
    const summary = [
      `Vehicle price: ${formatPrice(priceValue)}`,
      `Deposit: ${deposit}% (${formatPrice(depositAmount)})`,
      `Balloon: ${balloon}% (${formatPrice(balloonAmount)})`,
      `Term: ${months} months`,
      `Rate: ${interest === '' ? defaultInterest : interest}%`,
      `Estimated monthly: ${formatPrice(monthlyPayment)}/pm`,
    ].join('\n');
    if (leadName.trim() || leadPhone.trim()) {
      try {
        await supabase.from('leads').insert([{
          client_name: leadName.trim() || 'Calculator enquiry',
          client_phone: leadPhone.trim() || null,
          source: 'calculator',
          status: 'new',
          notes: `Finance calculator estimate request\n${summary}`,
        }] as any);
      } catch (e) {
        console.error('[Calculator] lead capture failed', e);
      }
    }
    const msg = `Hi Lumina Auto, please send me this finance estimate:\n\n${summary}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    toast.success('Opening WhatsApp with your estimate…');
    setIsSendingEstimate(false);
  };

  return (
    <>
      <Helmet>
        <title>Finance Calculator | Lumina Auto</title>
        <meta
          name="description"
          content="Calculate your monthly car payment with our finance calculator. See what you can afford with various deposit and balloon payment options."
        />
      </Helmet>

      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <CalculatorIcon className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <KineticText>Finance Calculator</KineticText>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Use our calculator to estimate your monthly payments. Adjust the vehicle price, deposit, and loan term to find what works for you.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-8 space-y-8"
          >
            {/* Vehicle Price Input */}
            <div className="space-y-4">
              <label className="block text-sm font-medium">Vehicle Price</label>
              <div className="flex gap-4 items-center">
                <Input
                  type="number"
                  value={vehiclePrice}
                  onChange={(e) => setVehiclePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={() => {
                    if (vehiclePrice === '') setVehiclePrice(0);
                  }}
                  min={50000}
                  max={10000000}
                  step={10000}
                  className="text-2xl font-bold h-14 bg-secondary border-border"
                />
              </div>
              <Slider
                value={[priceValue]}
                onValueChange={(value) => setVehiclePrice(value[0])}
                min={50000}
                max={6000000}
                step={25000}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R50,000</span>
                <span>R6,000,000</span>
              </div>
            </div>

            {/* Vehicle Year */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Vehicle Year</label>
                <span className="text-xs text-muted-foreground">(affects max balloon %)</span>
              </div>
              <Select value={vehicleYear.toString()} onValueChange={(val) => setVehicleYear(Number(val))}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deposit Slider with Manual Input */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Deposit</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={deposit}
                    onChange={(e) => {
                      const val = Math.min(50, Math.max(0, Number(e.target.value) || 0));
                      setDeposit(val);
                    }}
                    className="w-16 h-8 text-center text-sm px-2 bg-secondary border-border"
                    min={0}
                    max={50}
                  />
                  <span className="font-medium text-muted-foreground">% ({formatPrice(depositAmount)})</span>
                </div>
              </div>
              <Slider
                value={[deposit]}
                onValueChange={(value) => setDeposit(value[0])}
                min={0}
                max={50}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Balloon Payment Slider */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  Balloon Payment
                  <span className="text-xs text-primary">(Max {maxBalloon}% for {vehicleYear} model)</span>
                </span>
                <span className="font-medium">{balloon}% ({formatPrice(balloonAmount)})</span>
              </div>
              <Slider
                value={[balloon]}
                onValueChange={(value) => setBalloon(value[0])}
                min={0}
                max={maxBalloon}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{maxBalloon}%</span>
              </div>
              {vehicleAge > 0 && (
                <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg text-xs text-muted-foreground">
                  <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>
                    SA banks cap balloon payments based on vehicle age. A {vehicleYear} model ({vehicleAge} year{vehicleAge > 1 ? 's' : ''} old) allows max {maxBalloon}% balloon.
                  </span>
                </div>
              )}
            </div>

            {/* Term Select */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Loan Term</label>
              <Select value={months.toString()} onValueChange={(val) => setMonths(Number(val))}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                  <SelectItem value="36">36 months</SelectItem>
                  <SelectItem value="48">48 months</SelectItem>
                  <SelectItem value="60">60 months</SelectItem>
                  <SelectItem value="72">72 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interest Rate Slider + Input */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Interest Rate</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={interest}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setInterest('');
                      } else {
                        const val = parseFloat(e.target.value);
                        setInterest(isNaN(val) ? '' : val);
                      }
                    }}
                    onBlur={() => {
                      if (interest === '' || (typeof interest === 'number' && interest < minInterest)) {
                        setInterest(minInterest);
                      } else if (typeof interest === 'number' && interest > maxInterest) {
                        setInterest(maxInterest);
                      }
                    }}
                    min={minInterest}
                    max={maxInterest}
                    step={0.25}
                    className="w-20 h-8 text-center text-sm"
                  />
                  <span className="text-sm font-medium">%</span>
                </div>
              </div>
              <Slider
                value={[interest === '' ? minInterest : interest]}
                onValueChange={(value) => setInterest(value[0])}
                min={minInterest}
                max={maxInterest}
                step={0.25}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minInterest}%</span>
                <span>{maxInterest}%</span>
              </div>
            </div>

            {/* Summary */}
            <div className="pt-6 border-t border-border space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vehicle Price</span>
                <span>{formatPrice(priceValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less Deposit</span>
                <span>-{formatPrice(depositAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Financed</span>
                <span>{formatPrice(financeAmount)}</span>
              </div>
              {balloon > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">…of which balloon (deferred to end of term)</span>
                  <span>{formatPrice(balloonAmount)}</span>
                </div>
              )}
              
              {/* Monthly Payment - PROMINENT */}
              <div className="pt-6 border-t border-border">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-2">Your Estimated Monthly Payment</p>
                  <p className="font-display text-5xl md:text-6xl font-bold text-foreground">
                    {formatPrice(monthlyPayment)}
                    <span className="text-2xl text-muted-foreground">/pm</span>
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              *Estimate only. Subject to credit approval. Terms and conditions apply.
            </p>

            {/* Lead capture — WhatsApp the estimate (and log a lead). */}
            <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" /> Want this estimate on WhatsApp?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Your name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
                <Input type="tel" inputMode="tel" placeholder="Mobile number" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
              </div>
              {/* Honeypot — hidden from humans; bots that fill it are dropped. */}
              <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="calc-website">Website</label>
                <input id="calc-website" type="text" tabIndex={-1} autoComplete="off" value={leadWebsite} onChange={(e) => setLeadWebsite(e.target.value)} />
              </div>
              <Button onClick={handleSendEstimate} disabled={isSendingEstimate} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11">
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp me this estimate
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/finance-application" className="flex-1">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12">
                  Check My Buying Power
                </Button>
              </Link>
              <Link to="/inventory" className="flex-1">
                <Button variant="outline" className="w-full h-12">
                  Browse Vehicles
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Calculator;
