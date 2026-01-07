import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Calculator as CalculatorIcon, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import KineticText from '@/components/KineticText';
import { formatPrice } from '@/lib/formatters';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const Calculator = () => {
  const { data: settings } = useSiteSettings();
  
  // Dynamic settings from database
  const minInterest = settings?.min_interest ?? 10.5;
  const maxInterest = settings?.max_interest ?? 25;
  const defaultInterest = settings?.default_interest_rate ?? 13.5;

  const [vehiclePrice, setVehiclePrice] = useState(500000);
  const [vehicleYear, setVehicleYear] = useState(new Date().getFullYear());
  const [deposit, setDeposit] = useState(0); // Default deposit to 0%
  const [balloon, setBalloon] = useState(0);
  const [months, setMonths] = useState(72);
  const [interest, setInterest] = useState(defaultInterest);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  // Update interest when settings load
  useEffect(() => {
    if (settings?.default_interest_rate) {
      setInterest(settings.default_interest_rate);
    }
  }, [settings?.default_interest_rate]);

  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleYear;
  const maxBalloon = Math.max(0, 40 - vehicleAge * 5);

  // Clamp balloon if vehicle age changes
  useEffect(() => {
    if (balloon > maxBalloon) {
      setBalloon(maxBalloon);
    }
  }, [maxBalloon, balloon]);

  // PMT formula calculation
  useEffect(() => {
    const depositAmount = vehiclePrice * (deposit / 100);
    const balloonAmount = vehiclePrice * (balloon / 100);
    const principal = vehiclePrice - depositAmount;
    const monthlyRate = interest / 100 / 12;

    if (monthlyRate === 0) {
      setMonthlyPayment(Math.round((principal - balloonAmount) / months));
      return;
    }

    const pvMinusFv = principal - balloonAmount / Math.pow(1 + monthlyRate, months);
    const payment = (pvMinusFv * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

    setMonthlyPayment(Math.round(payment));
  }, [vehiclePrice, deposit, balloon, months, interest]);

  const depositAmount = vehiclePrice * (deposit / 100);
  const balloonAmount = vehiclePrice * (balloon / 100);
  const financeAmount = vehiclePrice - depositAmount;

  const yearOptions = Array.from({ length: 15 }, (_, i) => currentYear - i);

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
                  onChange={(e) => setVehiclePrice(Number(e.target.value))}
                  min={50000}
                  max={10000000}
                  step={10000}
                  className="text-2xl font-bold h-14 bg-secondary border-border"
                />
              </div>
              <Slider
                value={[vehiclePrice]}
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

            {/* Deposit Slider */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deposit</span>
                <span className="font-medium">{deposit}% ({formatPrice(depositAmount)})</span>
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
                      const val = parseFloat(e.target.value) || 0;
                      setInterest(Math.max(minInterest, Math.min(maxInterest, val)));
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
                value={[interest]}
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
                <span>{formatPrice(vehiclePrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less Deposit</span>
                <span>-{formatPrice(depositAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Finance Amount</span>
                <span>{formatPrice(financeAmount)}</span>
              </div>
              {balloon > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Balloon (end of term)</span>
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
