import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useVehicles';
import { DealAddOnItem } from '@/hooks/useDealRecords';
import { format } from 'date-fns';
import luminaLogo from '@/assets/lumina-logo.png';

interface DealData {
  id: string;
  sold_price: number;
  cost_price: number;
  recon_cost: number;
  gross_profit: number;
  dic_amount: number;
  discount_amount: number;
  dealer_deposit_contribution: number;
  is_shared_capital: boolean;
  partner_split_type: string;
  partner_split_value: number;
  partner_split_percent: number;
  partner_profit_amount: number;
  partner_capital_contribution: number;
  addons_data: DealAddOnItem[];
  referral_commission_amount: number;
  referral_income_amount: number;
  referral_person_name: string;
  sales_rep_name: string;
  sales_rep_commission: number;
  sale_date: string;
  vehicle_id: string;
  application_id: string;
}

interface VehicleData {
  make: string;
  model: string;
  year: number;
  variant: string | null;
  vin: string | null;
  registration_number: string | null;
}

interface ApplicationData {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
}

const AdminPartnerPayout = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const [deal, setDeal] = useState<DealData | null>(null);
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [client, setClient] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerExpenses, setLedgerExpenses] = useState<{ description: string; amount: number; category: string }[]>([]);

  useEffect(() => {
    if (dealId) fetchData();
  }, [dealId]);

  const fetchData = async () => {
    if (!dealId) return;

    const { data: dealData, error } = await (supabase as any)
      .from('deal_records')
      .select('*')
      .eq('id', dealId)
      .single();

    if (error || !dealData) {
      console.error('Failed to load deal:', error);
      setLoading(false);
      return;
    }

    setDeal(dealData);

    // Fetch vehicle
    if (dealData.vehicle_id) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('make, model, year, variant, vin, registration_number')
        .eq('id', dealData.vehicle_id)
        .single();
      if (v) setVehicle(v);

      // Fetch ledger expenses
      const { data: expenses } = await (supabase as any)
        .from('vehicle_expenses')
        .select('description, amount, category')
        .eq('vehicle_id', dealData.vehicle_id);
      if (expenses) setLedgerExpenses(expenses);
    }

    // Fetch client
    if (dealData.application_id) {
      const { data: app } = await supabase
        .from('finance_applications')
        .select('full_name, first_name, last_name')
        .eq('id', dealData.application_id)
        .single();
      if (app) setClient(app);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500">Loading report...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-red-500">Deal not found.</p>
      </div>
    );
  }

  // Calculations
  const soldPrice = deal.sold_price || 0;
  const costPrice = deal.cost_price || 0;
  const reconCost = deal.recon_cost || 0;
  const dicAmount = deal.dic_amount || 0;
  const referralIncome = deal.referral_income_amount || 0;
  const referralExpense = deal.referral_commission_amount || 0;
  const dealerDeposit = deal.dealer_deposit_contribution || 0;
  const discountAmount = deal.discount_amount || 0;

  const addons = (deal.addons_data || []) as DealAddOnItem[];
  const totalAddonCost = addons.reduce((s, a) => s + (a.cost || 0), 0);
  const totalAddonPrice = addons.reduce((s, a) => s + (a.price || 0), 0);

  const adjustedSellPrice = soldPrice - discountAmount;
  const grossIncome = adjustedSellPrice + totalAddonPrice + dicAmount + referralIncome;
  const totalCosts = costPrice + reconCost + dealerDeposit + totalAddonCost + referralExpense;
  const grossProfit = grossIncome - totalCosts;

  const partnerCapital = deal.partner_capital_contribution || 0;
  const partnerPayout = deal.partner_profit_amount || 0;
  const finalPayout = partnerCapital + partnerPayout;

  const fmtPrice = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <Helmet>
        <title>Partner Payout Report | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-white text-gray-900 p-8 print:p-4" style={{ maxWidth: '210mm', margin: '0 auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-gray-800">
          <div className="flex items-center gap-4">
            <img src={luminaLogo} alt="Lumina Auto" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">PARTNER PAYOUT REPORT</h1>
              <p className="text-sm text-gray-500">Confidential — Internal Use Only</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Date: {deal.sale_date ? format(new Date(deal.sale_date), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy')}</p>
            <p>Deal Ref: {deal.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {/* Client & Vehicle */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-sm font-bold uppercase text-gray-400 mb-2">Client</h2>
            <p className="font-semibold text-lg">{client?.first_name} {client?.last_name}</p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase text-gray-400 mb-2">Vehicle</h2>
            {vehicle ? (
              <>
                <p className="font-semibold text-lg">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant || ''}</p>
                <p className="text-sm text-gray-500">VIN: {vehicle.vin || 'N/A'} | Reg: {vehicle.registration_number || 'N/A'}</p>
              </>
            ) : (
              <p className="text-gray-500">Vehicle data not available</p>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase text-gray-400 mb-4">Financial Summary</h2>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Sale Price" value={fmtPrice(adjustedSellPrice)} />
              {totalAddonPrice > 0 && <Row label="+ VAP Revenue" value={fmtPrice(totalAddonPrice)} />}
              {dicAmount > 0 && <Row label="+ DIC (Bank Reward)" value={fmtPrice(dicAmount)} />}
              {referralIncome > 0 && <Row label="+ Referral Income" value={fmtPrice(referralIncome)} />}
              <Row label="Gross Income" value={fmtPrice(grossIncome)} bold />
              
              <tr><td colSpan={2} className="py-2"><hr className="border-gray-200" /></td></tr>
              
              <Row label="(Less) Purchase Price" value={`-${fmtPrice(costPrice)}`} negative />
              <Row label="(Less) Recon / Expenses" value={`-${fmtPrice(reconCost)}`} negative />
              {dealerDeposit > 0 && <Row label="(Less) Dealer Deposit Contribution" value={`-${fmtPrice(dealerDeposit)}`} negative />}
              {totalAddonCost > 0 && <Row label="(Less) VAP Costs" value={`-${fmtPrice(totalAddonCost)}`} negative />}
              {referralExpense > 0 && <Row label="(Less) Referral Expense" value={`-${fmtPrice(referralExpense)}`} negative />}
              
              <tr><td colSpan={2} className="py-2"><hr className="border-gray-800" /></td></tr>
              
              <Row label="NET PROFIT" value={fmtPrice(grossProfit)} bold highlight />
            </tbody>
          </table>
        </div>

        {/* Expense Breakdown */}
        {ledgerExpenses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase text-gray-400 mb-4">Expense Breakdown (Vehicle Ledger)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 font-medium text-gray-500">Description</th>
                  <th className="text-left py-1 font-medium text-gray-500">Category</th>
                  <th className="text-right py-1 font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledgerExpenses.map((exp, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1.5">{exp.description}</td>
                    <td className="py-1.5 capitalize text-gray-500">{exp.category}</td>
                    <td className="py-1.5 text-right">{fmtPrice(exp.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2" colSpan={2}>Total Expenses</td>
                  <td className="py-2 text-right">{fmtPrice(ledgerExpenses.reduce((s, e) => s + e.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Partner Distribution */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-gray-800">
          <h2 className="text-sm font-bold uppercase text-gray-400 mb-4">Partner Distribution</h2>
          <table className="w-full text-sm">
            <tbody>
              <Row
                label={`Partner Share (${deal.partner_split_type === 'percentage' ? `${deal.partner_split_value}%` : 'Fixed'})`}
                value={fmtPrice(partnerPayout)}
              />
              <Row label="(+) Capital Refund" value={fmtPrice(partnerCapital)} />
              <tr><td colSpan={2} className="py-2"><hr className="border-gray-800" /></td></tr>
              <Row label="FINAL PAYOUT TO PARTNER" value={fmtPrice(finalPayout)} bold highlight />
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
          <p>This document is auto-generated by Lumina Auto DMS. All figures are subject to final reconciliation.</p>
          <p className="mt-1">© {new Date().getFullYear()} Lumina Auto. Confidential.</p>
        </div>

        {/* Print Button (hidden on print) */}
        <div className="mt-8 text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            🖨️ Print Report
          </button>
        </div>
      </div>
    </>
  );
};

const Row = ({ label, value, bold, negative, highlight }: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) => (
  <tr className={highlight ? 'bg-gray-100' : ''}>
    <td className={`py-1.5 ${bold ? 'font-bold text-base' : ''}`}>{label}</td>
    <td className={`py-1.5 text-right ${bold ? 'font-bold text-base' : ''} ${negative ? 'text-red-600' : ''} ${highlight ? 'text-emerald-700' : ''}`}>
      {value}
    </td>
  </tr>
);

export default AdminPartnerPayout;
