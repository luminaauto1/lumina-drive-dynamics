import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Building2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinanceOffers, useCreateFinanceOffer, useUpdateFinanceOffer, FinanceOffer, FinanceOfferInsert } from '@/hooks/useFinanceOffers';
import { formatPrice } from '@/lib/formatters';

interface FinancePodiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  approvedBudget?: number;
}

const BANK_OPTIONS = ['Wesbank', 'MFC', 'Absa', 'Nedbank', 'Standard Bank', 'FNB', 'Capitec', 'Other'];

interface BankOfferForm {
  bank_name: string;
  cash_price: string;
  license_fee: string;
  delivery_fee: string;
  admin_fee: string;
  initiation_fee: string;
  balloon_amount: string;
  interest_rate_linked: string;
  instalment_linked: string;
  interest_rate_fixed: string;
  instalment_fixed: string;
  vap_amount: string;
}

const emptyForm: BankOfferForm = {
  bank_name: '',
  cash_price: '',
  license_fee: '',
  delivery_fee: '',
  admin_fee: '',
  initiation_fee: '',
  balloon_amount: '',
  interest_rate_linked: '',
  instalment_linked: '',
  interest_rate_fixed: '',
  instalment_fixed: '',
  vap_amount: '',
};

const FinancePodiumModal = ({ open, onOpenChange, applicationId, approvedBudget }: FinancePodiumModalProps) => {
  const { data: existingOffers = [], isLoading } = useFinanceOffers(applicationId);
  const createOffer = useCreateFinanceOffer();
  const updateOffer = useUpdateFinanceOffer();

  const [tabs, setTabs] = useState<BankOfferForm[]>([{ ...emptyForm, bank_name: 'Wesbank' }]);
  const [activeTab, setActiveTab] = useState('0');

  // Load existing offers into tabs
  useEffect(() => {
    if (existingOffers.length > 0) {
      const loadedTabs = existingOffers.map((offer) => ({
        bank_name: offer.bank_name,
        cash_price: offer.cash_price?.toString() || '',
        license_fee: offer.license_fee?.toString() || '',
        delivery_fee: offer.delivery_fee?.toString() || '',
        admin_fee: offer.admin_fee?.toString() || '',
        initiation_fee: offer.initiation_fee?.toString() || '',
        balloon_amount: offer.balloon_amount?.toString() || '',
        interest_rate_linked: offer.interest_rate_linked?.toString() || '',
        instalment_linked: offer.instalment_linked?.toString() || '',
        interest_rate_fixed: offer.interest_rate_fixed?.toString() || '',
        instalment_fixed: offer.instalment_fixed?.toString() || '',
        vap_amount: offer.vap_amount?.toString() || '',
      }));
      setTabs(loadedTabs);
    }
  }, [existingOffers]);

  const addTab = () => {
    const usedBanks = tabs.map((t) => t.bank_name);
    const nextBank = BANK_OPTIONS.find((b) => !usedBanks.includes(b)) || 'Other';
    setTabs([...tabs, { ...emptyForm, bank_name: nextBank }]);
    setActiveTab(String(tabs.length));
  };

  const removeTab = (index: number) => {
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    setActiveTab('0');
  };

  const updateTabField = (index: number, field: keyof BankOfferForm, value: string) => {
    const newTabs = [...tabs];
    newTabs[index] = { ...newTabs[index], [field]: value };
    setTabs(newTabs);
  };

  // Calculate totals
  const calculateTotals = (form: BankOfferForm) => {
    const fees = [
      parseFloat(form.license_fee) || 0,
      parseFloat(form.delivery_fee) || 0,
      parseFloat(form.admin_fee) || 0,
      parseFloat(form.initiation_fee) || 0,
    ];
    const totalFees = fees.reduce((a, b) => a + b, 0);
    const cashPrice = parseFloat(form.cash_price) || 0;
    const principalDebt = cashPrice + totalFees;
    return { totalFees, principalDebt };
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < tabs.length; i++) {
      const form = tabs[i];
      const { totalFees, principalDebt } = calculateTotals(form);

      const offerData: FinanceOfferInsert = {
        application_id: applicationId,
        bank_name: form.bank_name,
        cash_price: parseFloat(form.cash_price) || null,
        license_fee: parseFloat(form.license_fee) || null,
        delivery_fee: parseFloat(form.delivery_fee) || null,
        admin_fee: parseFloat(form.admin_fee) || null,
        initiation_fee: parseFloat(form.initiation_fee) || null,
        total_fees: totalFees || null,
        principal_debt: principalDebt || null,
        balloon_amount: parseFloat(form.balloon_amount) || null,
        interest_rate_linked: parseFloat(form.interest_rate_linked) || null,
        instalment_linked: parseFloat(form.instalment_linked) || null,
        interest_rate_fixed: parseFloat(form.interest_rate_fixed) || null,
        instalment_fixed: parseFloat(form.instalment_fixed) || null,
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Finance Podium - Bank Offers
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
            const { totalFees, principalDebt } = calculateTotals(form);
            return (
              <TabsContent key={index} value={String(index)} className="space-y-4">
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

                {/* Pricing Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Vehicle & Fees</h4>
                    
                    <div className="space-y-2">
                      <Label>Cash Price</Label>
                      <Input
                        type="number"
                        value={form.cash_price}
                        onChange={(e) => updateTabField(index, 'cash_price', e.target.value)}
                        placeholder="e.g. 350000"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>License Fee</Label>
                        <Input
                          type="number"
                          value={form.license_fee}
                          onChange={(e) => updateTabField(index, 'license_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Delivery Fee</Label>
                        <Input
                          type="number"
                          value={form.delivery_fee}
                          onChange={(e) => updateTabField(index, 'delivery_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Admin Fee</Label>
                        <Input
                          type="number"
                          value={form.admin_fee}
                          onChange={(e) => updateTabField(index, 'admin_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Initiation Fee</Label>
                        <Input
                          type="number"
                          value={form.initiation_fee}
                          onChange={(e) => updateTabField(index, 'initiation_fee', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Auto-calculated fields */}
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Fees:</span>
                        <span className="font-medium">{formatPrice(totalFees)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Principal Debt:</span>
                        <span className="font-semibold text-primary">{formatPrice(principalDebt)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Balloon Amount</Label>
                      <Input
                        type="number"
                        value={form.balloon_amount}
                        onChange={(e) => updateTabField(index, 'balloon_amount', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Interest & Instalments</h4>
                    
                    <div className="p-4 border border-border rounded-lg space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Linked Rate</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Interest Rate (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.interest_rate_linked}
                            onChange={(e) => updateTabField(index, 'interest_rate_linked', e.target.value)}
                            placeholder="e.g. 12.75"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Instalment</Label>
                          <Input
                            type="number"
                            value={form.instalment_linked}
                            onChange={(e) => updateTabField(index, 'instalment_linked', e.target.value)}
                            placeholder="e.g. 7500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border border-border rounded-lg space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fixed Rate</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Interest Rate (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.interest_rate_fixed}
                            onChange={(e) => updateTabField(index, 'interest_rate_fixed', e.target.value)}
                            placeholder="e.g. 14.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Instalment</Label>
                          <Input
                            type="number"
                            value={form.instalment_fixed}
                            onChange={(e) => updateTabField(index, 'instalment_fixed', e.target.value)}
                            placeholder="e.g. 8200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>VAP Amount (Optional)</Label>
                      <Input
                        type="number"
                        value={form.vap_amount}
                        onChange={(e) => updateTabField(index, 'vap_amount', e.target.value)}
                        placeholder="0"
                      />
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
