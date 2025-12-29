import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/data/vehicles';

interface FinanceCalculatorProps {
  vehiclePrice: number;
}

const FinanceCalculator = ({ vehiclePrice }: FinanceCalculatorProps) => {
  const [deposit, setDeposit] = useState(10); // percentage
  const [balloon, setBalloon] = useState(0); // percentage
  const [months, setMonths] = useState(72);
  const [interest, setInterest] = useState(13.5);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

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

    // PMT formula with balloon payment
    // PMT = (PV - FV/(1+r)^n) * r / (1 - (1+r)^-n)
    const pvMinusFv = principal - balloonAmount / Math.pow(1 + monthlyRate, months);
    const payment = (pvMinusFv * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

    setMonthlyPayment(Math.round(payment));
  }, [vehiclePrice, deposit, balloon, months, interest]);

  const depositAmount = vehiclePrice * (deposit / 100);
  const balloonAmount = vehiclePrice * (balloon / 100);
  const financeAmount = vehiclePrice - depositAmount;

  return (
    <div className="p-6 glass-card rounded-xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Finance Calculator</h3>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Interactive</span>
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
          <span className="text-muted-foreground">Balloon Payment</span>
          <span className="font-medium">{balloon}% ({formatPrice(balloonAmount)})</span>
        </div>
        <Slider
          value={[balloon]}
          onValueChange={(value) => setBalloon(value[0])}
          min={0}
          max={40}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>40%</span>
        </div>
      </div>

      {/* Term Select */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Loan Term</label>
        <Select value={months.toString()} onValueChange={(val) => setMonths(Number(val))}>
          <SelectTrigger className="w-full glass-card border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-white/10">
            <SelectItem value="12">12 months</SelectItem>
            <SelectItem value="24">24 months</SelectItem>
            <SelectItem value="36">36 months</SelectItem>
            <SelectItem value="48">48 months</SelectItem>
            <SelectItem value="60">60 months</SelectItem>
            <SelectItem value="72">72 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Interest Rate Input */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Interest Rate (%)</label>
        <Input
          type="number"
          value={interest}
          onChange={(e) => setInterest(Number(e.target.value))}
          min={0}
          max={30}
          step={0.5}
          className="glass-card border-white/10"
        />
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-white/10 space-y-3">
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
        <div className="flex justify-between text-lg font-semibold pt-2 border-t border-white/10">
          <span>Monthly Repayment</span>
          <span className="text-primary">{formatPrice(monthlyPayment)}/pm</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        *Estimate only. Subject to credit approval. Terms and conditions apply.
      </p>
    </div>
  );
};

export default FinanceCalculator;