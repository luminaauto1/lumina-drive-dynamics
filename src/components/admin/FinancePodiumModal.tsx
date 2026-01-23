import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Building2, Save, Calculator, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceOffers, useCreateFinanceOffer, useUpdateFinanceOffer, FinanceOfferInsert } from '@/hooks/useFinanceOffers';
import { formatPrice } from '@/lib/formatters';

interface FinancePodiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  approvedBudget?: number;
  vehiclePrice?: number;
  vehicleId?: string;
}

const BANK_OPTIONS = ['Wesbank', 'MFC', 'Absa', 'Nedbank', 'Standard Bank', 'FNB', 'Capitec', 'Other'];

const TERM_OPTIONS = [
  { value: 48, label: '48 months' },
  { value: 54, label: '54 months' },
  { value: 60, label: '60 months' },
  { value: 66, label: '66 months' },
  { value: 72, label: '72 months' },
  { value: 84, label: '84 months' },
  { value: 96, label: '96 months' },
];

interface BankOfferForm {
  bank_name: string;
  vehicle_price: string;
  deposit: string;
  balloon_percent: number;
  balloon_amount: string;
  term: number;
  license_fee: string;
  delivery_fee: string;
  admin_fee: string;
  initiation_fee: string;
  interest_rate_linked: string;
  instalment_linked: string;
  interest_rate_fixed: string;
  instalment_fixed: string;
  vap_amount: string;
}

const createEmptyForm = (vehiclePrice?: number): BankOfferForm => ({
  bank_name: '',
  vehicle_price: vehiclePrice?.toString() || '',
  deposit: '0',
  balloon_percent: 0,
  balloon_amount: '0',
  term: 72,
  license_fee: '',
  delivery_fee: '',
  admin_fee: '',
  initiation_fee: '',
  interest_rate_linked: '',
  instalment_linked: '',
  interest_rate_fixed: '',
  instalment_fixed: '',
  vap_amount: '',
});

// PMT formula for calculating monthly payment
const calculatePMT = (
  principal: number,
  annualRate: number,
  months: number,
  balloon: number = 0
): number => {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return (principal - balloon) / months;
  
  const monthlyRate = annualRate / 100 / 12;
  const presentValueOfBalloon = balloon / Math.pow(1 + monthlyRate, months);
  const adjustedPrincipal = principal - presentValueOfBalloon;
  
  const payment = adjustedPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                  (Math.pow(1 + monthlyRate, months) - 1);
  
  return Math.round(payment);
};

const FinancePodiumModal = ({ 
  open, 
  onOpenChange, 
  applicationId, 
  approvedBudget,
  vehiclePrice: propVehiclePrice,
  vehicleId 
}: FinancePodiumModalProps) => {
  const { data: existingOffers = [], isLoading } = useFinanceOffers(applicationId);
  const createOffer = useCreateFinanceOffer();
  const updateOffer = useUpdateFinanceOffer();

  const [tabs, setTabs] = useState<BankOfferForm[]>([{ ...createEmptyForm(propVehiclePrice), bank_name: 'Wesbank' }]);
  const [activeTab, setActiveTab] = useState('0');

  // Load existing offers into tabs OR set vehicle price from props
  useEffect(() => {
    if (existingOffers.length > 0) {
      const loadedTabs = existingOffers.map((offer) => {
        const cashPrice = offer.cash_price || propVehiclePrice || 0;
        const balloonAmount = offer.balloon_amount || 0;
        const balloonPercent = cashPrice > 0 ? Math.round((balloonAmount / cashPrice) * 100) : 0;
        
        return {
          bank_name: offer.bank_name,
          vehicle_price: cashPrice.toString(),
          deposit: '0', // We don't store deposit, calculate from principal_debt
          balloon_percent: balloonPercent,
          balloon_amount: balloonAmount.toString(),
          term: 72, // Default term
          license_fee: offer.license_fee?.toString() || '',
          delivery_fee: offer.delivery_fee?.toString() || '',
          admin_fee: offer.admin_fee?.toString() || '',
          initiation_fee: offer.initiation_fee?.toString() || '',
          interest_rate_linked: offer.interest_rate_linked?.toString() || '',
          instalment_linked: offer.instalment_linked?.toString() || '',
          interest_rate_fixed: offer.interest_rate_fixed?.toString() || '',
          instalment_fixed: offer.instalment_fixed?.toString() || '',
          vap_amount: offer.vap_amount?.toString() || '',
        };
      });
      setTabs(loadedTabs);
    } else if (propVehiclePrice) {
      setTabs([{ ...createEmptyForm(propVehiclePrice), bank_name: 'Wesbank' }]);
    }
  }, [existingOffers, propVehiclePrice]);

  const addTab = () => {
    const usedBanks = tabs.map((t) => t.bank_name);
    const nextBank = BANK_OPTIONS.find((b) => !usedBanks.includes(b)) || 'Other';
    setTabs([...tabs, { ...createEmptyForm(propVehiclePrice), bank_name: nextBank }]);
    setActiveTab(String(tabs.length));
  };

  const removeTab = (index: number) => {
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    setActiveTab('0');
  };

  const updateTabField = (index: number, field: keyof BankOfferForm, value: string | number) => {
    const newTabs = [...tabs];
    const form = newTabs[index];
    
    if (field === 'balloon_percent') {
      // Slider changed - update balloon amount
      const price = parseFloat(form.vehicle_price) || 0;
      const percent = value as number;
      const amount = Math.round(price * (percent / 100));
      newTabs[index] = { 
        ...form, 
        balloon_percent: percent, 
        balloon_amount: amount.toString() 
      };
    } else if (field === 'balloon_amount') {
      // Amount field changed - update balloon percent
      const price = parseFloat(form.vehicle_price) || 0;
      const amount = parseFloat(value as string) || 0;
      const percent = price > 0 ? Math.round((amount / price) * 100) : 0;
      newTabs[index] = { 
        ...form, 
        balloon_amount: value as string, 
        balloon_percent: Math.min(percent, 50) 
      };
    } else if (field === 'vehicle_price') {
      // Price changed - recalculate balloon amount based on current percent
      const price = parseFloat(value as string) || 0;
      const amount = Math.round(price * (form.balloon_percent / 100));
      newTabs[index] = { 
        ...form, 
        vehicle_price: value as string,
        balloon_amount: amount.toString()
      };
    } else {
      newTabs[index] = { ...form, [field]: value };
    }
    
    setTabs(newTabs);
  };

  // Calculate totals and auto-instalments
  const calculateTotals = (form: BankOfferForm) => {
    const fees = [
      parseFloat(form.license_fee) || 0,
      parseFloat(form.delivery_fee) || 0,
      parseFloat(form.admin_fee) || 0,
      parseFloat(form.initiation_fee) || 0,
    ];
    const totalFees = fees.reduce((a, b) => a + b, 0);
    const vehiclePrice = parseFloat(form.vehicle_price) || 0;
    const deposit = parseFloat(form.deposit) || 0;
    const balloonAmount = parseFloat(form.balloon_amount) || 0;
    
    // Loan amount = Vehicle Price - Deposit + Fees
    const loanAmount = vehiclePrice - deposit + totalFees;
    
    // Calculate instalments
    const linkedRate = parseFloat(form.interest_rate_linked) || 0;
    const fixedRate = parseFloat(form.interest_rate_fixed) || 0;
    
    const instalmentLinked = calculatePMT(loanAmount, linkedRate, form.term, balloonAmount);
    const instalmentFixed = calculatePMT(loanAmount, fixedRate, form.term, balloonAmount);
    
    return { 
      totalFees, 
      loanAmount, 
      instalmentLinked, 
      instalmentFixed,
      balloonAmount
    };
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < tabs.length; i++) {
      const form = tabs[i];
      const { totalFees, loanAmount, instalmentLinked, instalmentFixed, balloonAmount } = calculateTotals(form);

      const offerData: FinanceOfferInsert = {
        application_id: applicationId,
        bank_name: form.bank_name,
        cash_price: parseFloat(form.vehicle_price) || null,
        license_fee: parseFloat(form.license_fee) || null,
        delivery_fee: parseFloat(form.delivery_fee) || null,
        admin_fee: parseFloat(form.admin_fee) || null,
        initiation_fee: parseFloat(form.initiation_fee) || null,
        total_fees: totalFees || null,
        principal_debt: loanAmount || null,
        balloon_amount: balloonAmount || null,
        interest_rate_linked: parseFloat(form.interest_rate_linked) || null,
        instalment_linked: instalmentLinked || null,
        interest_rate_fixed: parseFloat(form.interest_rate_fixed) || null,
        instalment_fixed: instalmentFixed || null,
        vap_amount: parseFloat(form.vap_amount) || null,
        status: 'active',
      };

      // Check if this bank already has an offer
      const existingOffer = existingOffers.find((o) => o.bank_name === form.bank_name);
      if (existingOffer) {
        await updateOffer.mutateAsync({ id: existingOffer.id, updates: offerData });
      } else {
        await createOffer.mutateAsync(offerData);
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Finance Calculator - Bank Offers
          </DialogTitle>
        </DialogHeader>

        {approvedBudget && (
          <div className="p-3 bg-primary/10 rounded-lg mb-4">
            <p className="text-sm text-muted-foreground">
              Approved Budget: <span className="font-semibold text-primary">{formatPrice(approvedBudget)}</span>
            </p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center gap-2 mb-4">
            <TabsList className="flex-1 flex-wrap h-auto gap-1">
              {tabs.map((tab, index) => (
                <TabsTrigger
                  key={index}
                  value={String(index)}
                  className="relative data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {tab.bank_name || `Bank ${index + 1}`}
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTab(index);
                      }}
                      className="ml-2 w-4 h-4 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button variant="outline" size="sm" onClick={addTab} className="gap-1">
              <Plus className="w-4 h-4" />
              Add Bank
            </Button>
          </div>

          {tabs.map((form, index) => {
            const { totalFees, loanAmount, instalmentLinked, instalmentFixed, balloonAmount } = calculateTotals(form);
            const hasVehicle = !!vehicleId;
            
            return (
              <TabsContent key={index} value={String(index)} className="space-y-6">
                {/* Bank Selection */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {BANK_OPTIONS.map((bank) => (
                    <Button
                      key={bank}
                      type="button"
                      variant={form.bank_name === bank ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateTabField(index, 'bank_name', bank)}
                      className="text-xs"
                    >
                      {bank}
                    </Button>
                  ))}
                </div>

                {/* Calculator Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Column 1: Vehicle & Deposit */}
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Vehicle & Deposit
                    </h4>
                    
                    <div className="space-y-2">
                      <Label>Vehicle Price (R)</Label>
                      <Input
                        type="number"
                        value={form.vehicle_price}
                        onChange={(e) => updateTabField(index, 'vehicle_price', e.target.value)}
                        placeholder="e.g. 350000"
                        disabled={hasVehicle}
                        className={hasVehicle ? 'bg-muted cursor-not-allowed' : ''}
                      />
                      {hasVehicle && (
                        <p className="text-xs text-muted-foreground">Price from selected vehicle</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Deposit (R)</Label>
                      <Input
                        type="number"
                        value={form.deposit}
                        onChange={(e) => updateTabField(index, 'deposit', e.target.value)}
                        placeholder="0"
                      />
                      {parseFloat(form.vehicle_price) > 0 && parseFloat(form.deposit) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {Math.round((parseFloat(form.deposit) / parseFloat(form.vehicle_price)) * 100)}% of vehicle price
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label>Balloon Payment</Label>
                        <span className="text-sm font-medium text-primary">{form.balloon_percent}%</span>
                      </div>
                      <Slider
                        value={[form.balloon_percent]}
                        onValueChange={([value]) => updateTabField(index, 'balloon_percent', value)}
                        max={50}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={form.balloon_amount}
                          onChange={(e) => updateTabField(index, 'balloon_amount', e.target.value)}
                          placeholder="0"
                          className="flex-1"
                        />
                        <span className="flex items-center text-sm text-muted-foreground">R</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Loan Term</Label>
                      <Select
                        value={form.term.toString()}
                        onValueChange={(value) => updateTabField(index, 'term', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TERM_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Column 2: Fees */}
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
                    <h4 className="font-semibold text-sm">Fees & Charges</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">License Fee</Label>
                        <Input
                          type="number"
                          value={form.license_fee}
                          onChange={(e) => updateTabField(index, 'license_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Delivery Fee</Label>
                        <Input
                          type="number"
                          value={form.delivery_fee}
                          onChange={(e) => updateTabField(index, 'delivery_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Admin Fee</Label>
                        <Input
                          type="number"
                          value={form.admin_fee}
                          onChange={(e) => updateTabField(index, 'admin_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Initiation Fee</Label>
                        <Input
                          type="number"
                          value={form.initiation_fee}
                          onChange={(e) => updateTabField(index, 'initiation_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">VAP Amount (Optional)</Label>
                      <Input
                        type="number"
                        value={form.vap_amount}
                        onChange={(e) => updateTabField(index, 'vap_amount', e.target.value)}
                        placeholder="0"
                      />
                    </div>

                    {/* Summary */}
                    <div className="p-3 bg-background rounded-lg space-y-2 border border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Fees:</span>
                        <span className="font-medium">{formatPrice(totalFees)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Balloon:</span>
                        <span className="font-medium">{formatPrice(balloonAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                        <span className="text-muted-foreground">Loan Amount:</span>
                        <span className="font-semibold text-primary">{formatPrice(loanAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Interest & Instalments */}
                  <div className="space-y-4">
                    {/* Linked Rate Card */}
                    <div className="p-4 border-2 border-blue-500/30 rounded-lg bg-blue-500/5 space-y-3">
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Linked Rate</p>
                      <div className="space-y-2">
                        <Label className="text-xs">Interest Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.interest_rate_linked}
                          onChange={(e) => updateTabField(index, 'interest_rate_linked', e.target.value)}
                          placeholder="e.g. 12.75"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Monthly Instalment</Label>
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                          <p className="text-2xl font-bold text-blue-400">
                            {instalmentLinked > 0 ? formatPrice(instalmentLinked) : 'R 0'}
                          </p>
                          <p className="text-xs text-blue-400/70">Auto-calculated</p>
                        </div>
                      </div>
                    </div>

                    {/* Fixed Rate Card */}
                    <div className="p-4 border-2 border-emerald-500/30 rounded-lg bg-emerald-500/5 space-y-3">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Fixed Rate</p>
                      <div className="space-y-2">
                        <Label className="text-xs">Interest Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.interest_rate_fixed}
                          onChange={(e) => updateTabField(index, 'interest_rate_fixed', e.target.value)}
                          placeholder="e.g. 14.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Monthly Instalment</Label>
                        <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                          <p className="text-2xl font-bold text-emerald-400">
                            {instalmentFixed > 0 ? formatPrice(instalmentFixed) : 'R 0'}
                          </p>
                          <p className="text-xs text-emerald-400/70">Auto-calculated</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAll} className="gap-2" disabled={createOffer.isPending || updateOffer.isPending}>
            <Save className="w-4 h-4" />
            Save All Offers
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinancePodiumModal;
