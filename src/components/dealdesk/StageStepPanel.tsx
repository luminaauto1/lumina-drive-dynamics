import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, PackageCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import type { Deal } from '@/lib/dealdesk/types';
import { isAwaitingFinalize } from './isAwaitingFinalize';
import { currentStepIndex } from '@/lib/dealdesk/stageFlow';
import { useDealRecordRaw, useSetDealStage } from '@/hooks/dealdesk/useDealDesk';
import { useVehicleStockDocs, countOutstanding } from '@/hooks/useVehicleStockDocs';
import StockDocsChecklist from '@/components/admin/StockDocsChecklist';
import FinalizeDealModal, { type ExistingDealData } from '@/components/admin/FinalizeDealModal';
import { useQueryClient } from '@tanstack/react-query';

/**
 * The guided, actionable area that sits under the StageBar in the drawer. It shows
 * the work for the deal's CURRENT step:
 *   ① Stock the car  — the linked vehicle's StockDocsChecklist (what's outstanding)
 *   ② Finalize       — opens the embedded FinalizeDealModal in place (no page jump),
 *                      warning (never blocking) if the car isn't stocked / docs incomplete
 *   ③ Delivery & NATIS / ④ Cleared — a pointer to the Delivery & Natis tab
 *
 * Finalize reuses FinalizeDealModal AS-IS (the Phase-3 enrich-existing-draft path),
 * so gross_profit stays the single authoritative number. On success we only advance
 * the deal-stage track to 'in_delivery'.
 */
export function StageStepPanel({ deal }: { deal: Deal }) {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const setStage = useSetDealStage();
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const { data: rawRow } = useDealRecordRaw(finalizeOpen ? deal.id : null);
  const { data: stockDocs } = useVehicleStockDocs(deal.vehicle_id ?? undefined);

  const outstanding = countOutstanding(stockDocs);
  const docsIncomplete = (stockDocs?.length ?? 0) > 0 && outstanding > 0;
  const awaiting = isAwaitingFinalize(deal);
  const step = currentStepIndex(deal);

  // Build the modal's existingDeal from the full raw row when available, else from
  // the lean Deal adapter. Either way the modal defaults any missing field sanely.
  const existingDeal: ExistingDealData | null = useMemo(() => {
    const base = rawRow ?? {
      id: deal.id,
      application_id: deal.application_id,
      vehicle_id: deal.vehicle_id,
      sold_price: deal.sold_price,
      cost_price: deal.cost_price,
      recon_cost: deal.recon_cost,
      gross_profit: deal.gross_profit,
      sale_date: deal.sale_date,
      delivery_date: deal.delivery_date_raw,
    };
    return base as ExistingDealData;
  }, [rawRow, deal]);

  const vehicleInfo = rawRow?.vehicle
    ? {
        year: rawRow.vehicle.year,
        make: rawRow.vehicle.make,
        model: rawRow.vehicle.model,
        stock_number: rawRow.vehicle.stock_number,
        cost_price: rawRow.vehicle.cost_price,
        purchase_price: rawRow.vehicle.purchase_price,
        reconditioning_cost: rawRow.vehicle.reconditioning_cost,
      }
    : null;

  const onFinalized = () => {
    setFinalizeOpen(false);
    // Advance the deal track forward (never backwards) — finalize means the deal
    // is finalized and ready for delivery. Profit math is owned by the modal.
    setStage.mutate({ dealId: deal.id, stage: 'in_delivery', currentStage: deal.deal_stage });
    qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
    qc.invalidateQueries({ queryKey: ['dealdesk', 'deal-record-raw', deal.id] });
    qc.invalidateQueries({ queryKey: ['deal-records'] });
  };

  return (
    <div className="space-y-4">
      {/* ── ① STOCK THE CAR ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PackageCheck className="h-4 w-4 text-primary" />
          <span><span className="text-muted-foreground">①</span> Stock the car</span>
        </div>
        {deal.vehicle_id ? (
          <StockDocsChecklist
            vehicleId={deal.vehicle_id}
            title="Stock-in documents"
            description="Bring this car into stock. Outstanding items warn on finalize — they never block."
          />
        ) : (
          <p className="text-xs text-muted-foreground">No vehicle is linked to this deal yet, so there are no stock-in documents to track.</p>
        )}
      </section>

      {/* ── ② FINALIZE ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileSignature className="h-4 w-4 text-primary" />
          <span><span className="text-muted-foreground">②</span> Finalize the deal</span>
        </div>

        {awaiting ? (
          <>
            <p className="text-xs text-muted-foreground">
              This deal is a draft awaiting finalize. Finalize it here — without leaving the Deal Desk — to set its
              official gross profit and move it into delivery.
            </p>

            {docsIncomplete && (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-200">
                <AlertTriangle className="h-4 w-4 !text-amber-400" />
                <AlertTitle className="text-amber-300">Car not fully stocked</AlertTitle>
                <AlertDescription className="text-amber-200/90">
                  {outstanding} stock-in document{outstanding === 1 ? '' : 's'} still outstanding for this car. You can
                  still finalize — but completing the documents above first is recommended.
                </AlertDescription>
              </Alert>
            )}

            {isSuperAdmin ? (
              <Button onClick={() => setFinalizeOpen(true)} className="gap-2">
                <FileSignature className="h-4 w-4" /> Finalize this deal
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Only an admin can finalize this deal.</p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Finalized — gross profit is recorded.
          </div>
        )}
      </section>

      {/* ── ③/④ DELIVERY & NATIS pointer ───────────────────────────────── */}
      {step >= 3 && (
        <section className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-primary" />
            <span><span className="text-muted-foreground">③</span> Delivery &amp; NATIS</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {deal.natis_sent
              ? 'NATIS has been sent — this deal is cleared.'
              : 'Use the Delivery & Natis tab to mark the car delivery-ready and record NATIS as sent. Those actions advance the stage to Delivered, then Cleared.'}
          </p>
        </section>
      )}

      {/* Embedded finalize modal — reused as-is; profit math untouched. */}
      {finalizeOpen && (
        <FinalizeDealModal
          isOpen={finalizeOpen}
          onClose={() => setFinalizeOpen(false)}
          applicationId={deal.application_id || ''}
          vehicleId={deal.vehicle_id || ''}
          vehiclePrice={Number(rawRow?.vehicle?.price ?? deal.sold_price ?? 0)}
          vehicleMileage={Number(rawRow?.sold_mileage ?? rawRow?.vehicle?.mileage ?? 0)}
          vehicleStatus={rawRow?.vehicle?.status ?? 'sold'}
          vehicle={vehicleInfo}
          existingDeal={existingDeal}
          onSuccess={onFinalized}
        />
      )}
    </div>
  );
}
