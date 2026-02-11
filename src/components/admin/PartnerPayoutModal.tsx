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
        // Query by 'id' which is the primary key column in deal_records
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

  const vehicle = deal?.vehicle || {};
  const partnerProfit = Number(deal?.partner_profit_amount || 0);
  const partnerCapital = Number(deal?.partner_capital_contribution || 0);
  const totalPayout = partnerProfit + partnerCapital;

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
                    <p className="text-sm text-gray-500">Lumina Auto | {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                    <p className="text-sm text-gray-600">{vehicle.registration_number}</p>
                    <p className="text-xs text-gray-500">VIN: {vehicle.vin}</p>
                  </div>
                </div>

                {/* NUMBERS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">Deal Economics</h2>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Selling Price</span>
                        <span className="font-medium text-gray-900">R {Number(deal.sold_price || 0).toLocaleString()}</span>
                      </div>
                      {Number(deal.dic_amount) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>DIC / Bank Reward</span>
                          <span>+ R {Number(deal.dic_amount).toLocaleString()}</span>
                        </div>
                      )}
                      {Number(deal.referral_income_amount) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Referral Income</span>
                          <span>+ R {Number(deal.referral_income_amount).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <p className="font-bold text-xs text-gray-500 mb-1">EXPENSES</p>
                      </div>
                      <div className="flex justify-between text-red-700">
                        <span>Vehicle Cost</span>
                        <span>- R {Number(deal.cost_price || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-red-700">
                        <span>Recon & Expenses</span>
                        <span>- R {(Number(deal.recon_cost || 0) + Number(deal.dealer_deposit_contribution || 0)).toLocaleString()}</span>
                      </div>
                      {Number(deal.referral_commission_amount) > 0 && (
                        <div className="flex justify-between text-red-700">
                          <span>Referral Paid Out</span>
                          <span>- R {Number(deal.referral_commission_amount).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2 text-gray-900">
                        <span>Gross Profit</span>
                        <span>R {(Number(deal.gross_profit || 0) + partnerProfit).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded-lg p-4">
                    <h2 className="font-bold text-lg mb-3 text-gray-900 border-b pb-2">Partner Distribution</h2>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                        <span className="text-gray-700">
                          Profit Share ({deal.partner_split_type === 'percentage' ? deal.partner_split_value + '%' : 'Fixed'})
                        </span>
                        <span className="font-bold text-gray-900">R {partnerProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                        <span className="text-gray-700">Capital Contribution Refund</span>
                        <span className="font-bold text-gray-900">+ R {partnerCapital.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg border border-green-300 mt-4">
                        <span className="font-bold text-green-900">TOTAL PAYOUT</span>
                        <span className="font-bold text-xl text-green-900">R {totalPayout.toLocaleString()}</span>
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
