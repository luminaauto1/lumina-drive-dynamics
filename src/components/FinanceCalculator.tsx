import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, BadgeCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatPrice, calculateMaxBalloon } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useUserActiveOffer } from '@/hooks/useFinanceOffers';
import { calculateDynamicInterestRate } from '@/lib/financeLogic';

interface FinanceCalculatorProps {
  vehiclePrice: number;
  vehicleYear?: number;
  vehicleBodyType?: string;
}

const FinanceCalculator = ({ vehiclePrice, vehicleYear, vehicleBodyType }: FinanceCalculatorProps) => {
  const { user } = useAuth();
  const { data: settings } = useSiteSettings();
  const { data: activeOffer } = useUserActiveOffer(user?.id);
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const year = vehicleYear || currentYear;
  
  // Get dynamic settings or fallback to defaults
  const defaultInterestRate = settings?.default_interest_rate || 13.5;
  const globalMaxBalloon = settings?.max_balloon_percent || 40;
  
  // Calculate vehicle-specific max balloon (based on age) but cap at global max
  const vehicleMaxBalloon = calculateMaxBalloon(year);
  const maxBalloon = Math.min(vehicleMaxBalloon, globalMaxBalloon);
  const vehicleAge = currentYear - year;

  const [deposit, setDeposit] = useState(0);
  const [balloon, setBalloon] = useState(0);
  const [months, setMonths] = useState(72);
  const [interest, setInterest] = useState(defaultInterestRate);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [isCashBuyer, setIsCashBuyer] = useState(false);
  const [hasActiveOffer, setHasActiveOffer] = useState(false);
  
  // Calculate dynamic interest using bank scoring algorithm
  const rateAdjustment = useMemo(() => {
    const baseRate = activeOffer?.interest_rate_linked || activeOffer?.interest_rate_fixed || defaultInterestRate;
    return calculateDynamicInterestRate(baseRate, {
      vehicleYear: year,
      bodyType: vehicleBodyType,
      depositPercent: deposit,
    });
  }, [activeOffer, defaultInterestRate, year, vehicleBodyType, deposit]);

  // Update interest when settings load OR when dynamic rate changes
  useEffect(() => {
    // Use the dynamic rate which accounts for vehicle risk profile
    setInterest(rateAdjustment.finalRate);
  }, [rateAdjustment.finalRate]);

  // Override with bank offer values if available
  useEffect(() => {
    if (activeOffer) {
      setHasActiveOffer(true);
      // Use linked rate as default (usually better)
      if (activeOffer.interest_rate_linked) {
        setInterest(activeOffer.interest_rate_linked);
      } else if (activeOffer.interest_rate_fixed) {
        setInterest(activeOffer.interest_rate_fixed);
      }
      // Set balloon from offer
      if (activeOffer.balloon_amount && vehiclePrice > 0) {
        const balloonPercent = Math.round((activeOffer.balloon_amount / vehiclePrice) * 100);
        setBalloon(Math.min(balloonPercent, maxBalloon));
      }
    }
  }, [activeOffer, vehiclePrice, maxBalloon]);

  // Clamp balloon if maxBalloon changes
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

  const handleCheckBuyingPower = () => {
    if (isCashBuyer) {
      navigate('/contact');
    } else if (user) {
      navigate('/finance-application');
    } else {
      navigate('/auth', { state: { returnTo: '/finance-application' } });
    }
  };

  return (
    <div className="p-6 glass-card rounded-xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Finance Calculator</h3>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Interactive</span>
      </div>

      {/* Bank Offer Badge */}
      {hasActiveOffer && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <BadgeCheck className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-sm font-medium text-emerald-400">Bank Offer Applied</p>
            <p className="text-xs text-muted-foreground">
              {activeOffer?.bank_name} - Rate: {activeOffer?.interest_rate_linked || activeOffer?.interest_rate_fixed}%
            </p>
          </div>
        </div>
      )}

      {/* Cash Buyer Toggle */}
      <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
        <Checkbox
          id="cashBuyerCalc"
          checked={isCashBuyer}
          onCheckedChange={(checked) => setIsCashBuyer(checked as boolean)}
        />
        <Label htmlFor="cashBuyerCalc" className="text-sm cursor-pointer">
          I am a Cash Buyer
        </Label>
      </div>

      {/* Finance options - only show for finance buyers */}
      {!isCashBuyer && (
        <>
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
                  className="w-16 h-7 text-center text-sm px-2"
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

          {/* Balloon Payment Slider - with Smart Cap */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                Balloon Payment
                <span className="text-xs text-primary">(Max {maxBalloon}%)</span>
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
              <div className="flex items-start gap-2 p-2 bg-primary/5 rounded text-xs text-muted-foreground">
                <Info className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                <span>{year} model = max {maxBalloon}% balloon</span>
              </div>
            )}
          </div>

          {/* Term Select */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Loan Term</label>
            <Select value={months.toString()} onValueChange={(val) => setMonths(Number(val))}>
              <SelectTrigger className="w-full glass-card border-border">
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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{interest.toFixed(2)}%</span>
            </div>
            <Slider
              value={[interest]}
              onValueChange={(value) => setInterest(value[0])}
              min={0}
              max={30}
              step={0.25}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Summary */}
          <div className="pt-4 border-t border-border space-y-3">
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
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
              <span>Monthly Repayment</span>
              <span className="text-primary" title="Est. only. Subject to bank approval & interest rates.">{formatPrice(monthlyPayment)}/pm*</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            *Est. only. Subject to bank approval & interest rates.
          </p>
        </>
      )}

      {/* Cash buyer summary */}
      {isCashBuyer && (
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex justify-between text-lg font-semibold">
            <span>Vehicle Price</span>
            <span className="text-primary">{formatPrice(vehiclePrice)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            As a cash buyer, you can proceed directly to enquire about this vehicle.
          </p>
        </div>
      )}

      <button 
        onClick={handleCheckBuyingPower}
        className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:bg-accent/90 transition-colors"
      >
        {isCashBuyer ? 'Enquire Now' : 'Check My Buying Power'}
      </button>
    </div>
  );
};

export default FinanceCalculator;