import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PartnerPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
}

export const PartnerPayoutModal = ({ isOpen, onClose, dealId }: PartnerPayoutModalProps) => {
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && dealId) {
      setLoading(true);
      const fetchDeal = async () => {
        const { data, error } = await supabase
          .from('deal_records')
          .select('*, vehicle:vehicles(make, model, year, vin, registration_number)')
          .eq('id', dealId)
          .maybeSingle();

        if (error || !data) {
          toast({ variant: "destructive", title: "Error", description: "Could not load deal data." });
          onClose();
        } else {
          setDeal(data);
        }
        setLoading(false);
      };
      fetchDeal();
    }
  }, [isOpen, dealId]);

  if (!isOpen) return null;

  // --- STRICT "METAL" LOGIC ---
  const vehicle = deal?.vehicle || {};

  // 1. REVENUE (The Metal)
  const sellingPrice = Number(deal?.sold_price || 0);
  const discount = Number(deal?.discount_amount || 0);
  const soldPriceNet = sellingPrice - discount;

  // 2. CAPITAL (Partner's Input)
  const vehicleCost = Number(deal?.cost_price || 0);
  const partnerCapital = Number(deal?.partner_capital_contribution || 0) || vehicleCost;

  // 3. GROSS PROFIT (Raw Money on Metal)
  const grossProfit = soldPriceNet - vehicleCost;

  // 4. DEDUCTIONS (Lumina's Expenses) — excludes Bank Fees/Admin Fees
  const reconCosts = Number(deal?.recon_cost || 0);
  const otherLuminaExpenses = Number(deal?.dealer_deposit_contribution || 0);
  const totalDeductions = reconCosts + otherLuminaExpenses;

  // 5. NET PROFIT (Before Retained Income)
  const netProfit = grossProfit - totalDeductions;

  // 6. RETAINED INCOME (Lumina's "Pure Money" — NOT shared with partner)
  const dicRetained = Number(deal?.dic_amount || 0);
  const addonsData = Array.isArray(deal?.addons_data) ? deal.addons_data : [];
  const vapRevenue = addonsData.reduce((s: number, a: any) => s + Number(a.price || 0), 0);
  const vapCost = addonsData.reduce((s: number, a: any) => s + Number(a.cost || 0), 0);
  const vapProfit = Math.max(0, vapRevenue - vapCost);
  const totalRetained = dicRetained + vapProfit;

  // 7. DISTRIBUTABLE PROFIT (The Shared Pot)
  const distributableProfit = netProfit - totalRetained;

  // 8. THE SPLIT
  const partnerPercent = deal?.partner_split_type === 'percentage'
    ? (Number(deal?.partner_split_value) / 100)
    : 0;

  const partnerShareAmount = deal?.partner_split_type === 'percentage'
    ? distributableProfit * partnerPercent
    : Number(deal?.partner_profit_amount || 0);
  const luminaShareAmount = distributableProfit - partnerShareAmount;

  // 9. PAYOUTS
  const partnerPayoutTotal = partnerCapital + partnerShareAmount;
  const luminaKeepsTotal = totalDeductions + totalRetained + luminaShareAmount;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div id="partner-report-modal">
          {/* TOOLBAR */}
          <div className="no-print flex items-center justify-between p-4 border-b border-border">
            <span className="font-bold text-lg">Partner Payout (Metal Logic)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="h-4 w-4 mr-1" /> Print Report
              </Button>
            </div>
          </div>

          {/* REPORT CANVAS */}
          <div className="p-6 bg-white text-black min-h-[600px]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Partner Payout</h1>
                    <p className="text-sm text-gray-500">Lumina Deal Record | {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{vehicle.make} {vehicle.model}</p>
                    <p className="text-sm text-gray-600">{vehicle.year} | {vehicle.registration_number}</p>
                  </div>
                </div>

                {/* MAIN GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* LEFT: THE MATH */}
                  <div className="space-y-4">
                    {/* 1. GROSS */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">1. Gross Profit (The Metal)</h2>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Sold Price (Net)</span>
                          <span className="font-medium text-gray-900">R {soldPriceNet.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-red-700">
                          <span>Less: Vehicle Cost (Capital)</span>
                          <span>- R {vehicleCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2 text-gray-900">
                          <span>GROSS PROFIT</span>
                          <span>R {grossProfit.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. DEDUCTIONS */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">2. Deductions (Paid by Lumina)</h2>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Recon & Prep</span>
                          <span className="text-gray-900">R {reconCosts.toLocaleString()}</span>
                        </div>
                        {otherLuminaExpenses > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Deposits/Other</span>
                            <span className="text-gray-900">R {otherLuminaExpenses.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2 text-red-800">
                          <span>TOTAL DEDUCTIONS</span>
                          <span>- R {totalDeductions.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. NET PROFIT */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg text-gray-900">3. NET PROFIT</span>
                        <span className="font-bold text-2xl text-gray-900">R {netProfit.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">(Gross Profit - Deductions)</p>
                    </div>

                    {/* 4. RETAINED INCOME */}
                    <div className="border border-amber-300 rounded-lg p-4 bg-amber-50">
                      <h2 className="font-bold text-lg mb-3 text-amber-900 border-b border-amber-200 pb-2">4. Retained Income (Lumina Only)</h2>
                      <div className="space-y-2 text-sm">
                        {dicRetained > 0 && (
                          <div className="flex justify-between">
                            <span className="text-amber-800">DIC (Bank Reward)</span>
                            <span className="text-amber-900">R {dicRetained.toLocaleString()}</span>
                          </div>
                        )}
                        {vapProfit > 0 && (
                          <div className="flex justify-between">
                            <span className="text-amber-800">VAP Profit</span>
                            <span className="text-amber-900">R {vapProfit.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-amber-300 pt-2 mt-2 text-amber-900">
                          <span>TOTAL RETAINED</span>
                          <span>- R {totalRetained.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 5. DISTRIBUTABLE PROFIT */}
                    <div className="border border-gray-300 rounded-lg p-4 text-center">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg text-gray-900">5. DISTRIBUTABLE PROFIT</span>
                        <span className="font-bold text-2xl text-gray-900">R {distributableProfit.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">(Net Profit - Retained Income)</p>
                    </div>
                  </div>

                  {/* RIGHT: THE DISTRIBUTION */}
                  <div className="space-y-4">
                    {/* 6. THE SPLIT */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">6. The Split (on Distributable)</h2>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                          <span className="text-gray-700">
                            Partner Share ({deal?.partner_split_type === 'percentage' ? (partnerPercent * 100).toFixed(0) + '%' : 'Fixed'})
                          </span>
                          <span className="font-bold text-gray-900">R {partnerShareAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                          <span className="text-gray-700">
                            Lumina Share ({deal?.partner_split_type === 'percentage' ? (100 - partnerPercent * 100).toFixed(0) + '%' : ''})
                          </span>
                          <span className="font-bold text-gray-900">R {luminaShareAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 5. FINAL TRANSFERS */}
                    <div className="space-y-3">
                      {/* PARTNER CARD */}
                      <div className="border border-green-300 rounded-lg p-4 bg-green-50">
                        <h3 className="font-bold text-green-900 mb-2">Transfer To Partner</h3>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-green-800">Capital Refund</span>
                            <span className="text-green-900">R {partnerCapital.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-800">Profit Share</span>
                            <span className="text-green-900">+ R {partnerShareAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t border-green-300 pt-2 mt-2 text-green-900">
                            <span>PAYOUT</span>
                            <span className="text-xl">R {partnerPayoutTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* LUMINA CARD */}
                      <div className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                        <h3 className="font-bold text-blue-900 mb-2">Lumina Keeps</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-blue-800">Total Retained</span>
                          <span className="font-bold text-xl text-blue-900">R {luminaKeepsTotal.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                          Expenses (R {totalDeductions.toLocaleString()}) + Retained (R {totalRetained.toLocaleString()}) + Share
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FOOTER NOTE */}
                <div className="mt-6 border-t pt-4">
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>* This calculation excludes external Banking Fees, Admin Fees, and DIC, which are handled separately.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
