import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer, X } from "lucide-react";
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

  // --- GOOGLE SCRIPT LOGIC IMPLEMENTATION ---
  const vehicle = deal?.vehicle || {};

  // 1. Pricing Structure
  const retailPrice = Number(deal?.sold_price || 0);
  const discount = Number(deal?.discount_amount || 0);
  const soldPriceNet = retailPrice - discount;
  const vehicleCost = Number(deal?.cost_price || 0);

  // 2. Expenses (Summing all costs like the script)
  const reconCost = Number(deal?.recon_cost || 0);
  const adminFee = Number(deal?.external_admin_fee || 0);
  const bankFee = Number(deal?.bank_initiation_fee || 0);
  const dealerDeposit = Number(deal?.dealer_deposit_contribution || 0);
  const referralPaid = Number(deal?.referral_commission_amount || 0);
  const expenses = reconCost + adminFee + bankFee + dealerDeposit + referralPaid;

  // 3. Profit Distribution
  const netProfitPot = (soldPriceNet - vehicleCost) - expenses;

  // Partner Settings
  const partnerPercent = deal?.partner_split_type === 'percentage'
    ? (Number(deal?.partner_split_value) / 100)
    : 0;

  const partnerCapital = Number(deal?.partner_capital_contribution || 0);

  // Shares
  const partnerShareProfit = deal?.partner_split_type === 'percentage'
    ? netProfitPot * partnerPercent
    : Number(deal?.partner_profit_amount || 0);
  const luminaShareProfit = netProfitPot - partnerShareProfit;

  // 4. Final Payouts
  const luminaTotal = luminaShareProfit + expenses;
  const partnerTotal = partnerShareProfit + partnerCapital;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div id="partner-report-modal">
          {/* TOOLBAR */}
          <div className="no-print flex items-center justify-between p-4 border-b border-border">
            <span className="font-bold text-lg">Partner Payout Preview</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
              </Button>
            </div>
          </div>

          {/* REPORT CONTENT */}
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
                    <p className="text-sm text-gray-500">Lumina Deal Calculator | Generated: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{vehicle.make} {vehicle.model}</p>
                    <p className="text-sm text-gray-600">{vehicle.year} | {vehicle.registration_number}</p>
                    <p className="text-xs text-gray-500">VIN: {vehicle.vin}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* LEFT COLUMN: FINANCIAL BREAKDOWN */}
                  <div className="space-y-4">
                    {/* PRICING */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">Pricing Structure</h2>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Retail Price</span>
                          <span className="font-medium text-gray-900">R {retailPrice.toLocaleString()}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-red-700">
                            <span>Less Discount</span>
                            <span>- R {discount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2 text-gray-900">
                          <span>SUB TOTAL (Sold Price)</span>
                          <span>R {soldPriceNet.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-red-700">
                          <span>Less Vehicle Cost</span>
                          <span>- R {vehicleCost.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* EXPENSES */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">Expenses (Recouped by Lumina)</h2>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Recon / Repairs</span>
                          <span className="text-gray-900">R {reconCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Admin / On Road</span>
                          <span className="text-gray-900">R {adminFee.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Bank Fees</span>
                          <span className="text-gray-900">R {bankFee.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Dealer Deposit</span>
                          <span className="text-gray-900">R {dealerDeposit.toLocaleString()}</span>
                        </div>
                        {referralPaid > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Referral Paid Out</span>
                            <span className="text-gray-900">R {referralPaid.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2 text-red-800">
                          <span>TOTAL EXPENSES</span>
                          <span>R {expenses.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: DISTRIBUTION */}
                  <div className="space-y-4">
                    {/* PROFIT POT */}
                    <div className="border border-gray-300 rounded-lg p-4 text-center">
                      <h2 className="font-bold text-lg mb-2 text-gray-900">Net Profit (Pot)</h2>
                      <p className="text-3xl font-bold text-gray-900">R {netProfitPot.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">(Sold Price - Cost - Expenses)</p>
                    </div>

                    {/* SHARES */}
                    <div className="border border-gray-300 rounded-lg p-4">
                      <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">Profit Shares</h2>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                          <span className="text-gray-700">
                            Partner Share ({deal?.partner_split_type === 'percentage' ? (partnerPercent * 100).toFixed(0) + '%' : 'Fixed'})
                          </span>
                          <span className="font-bold text-gray-900">R {partnerShareProfit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                          <span className="text-gray-700">
                            Lumina Share ({deal?.partner_split_type === 'percentage' ? (100 - partnerPercent * 100).toFixed(0) + '%' : ''})
                          </span>
                          <span className="font-bold text-gray-900">R {luminaShareProfit.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* FINAL PAYOUTS */}
                    <div className="space-y-3">
                      {/* LUMINA BOX */}
                      <div className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-blue-900">LUMINA KEEPS</span>
                          <span className="font-bold text-xl text-blue-900">R {luminaTotal.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">Share + Recouped Expenses</p>
                      </div>

                      {/* PARTNER BOX */}
                      <div className="border border-green-300 rounded-lg p-4 bg-green-50">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-green-900">TRANSFER TO PARTNER</span>
                          <span className="font-bold text-xl text-green-900">R {partnerTotal.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">Share + Capital Refund (R {partnerCapital.toLocaleString()})</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-8">
                  System Generated Document | Lumina Auto Deal Records
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
