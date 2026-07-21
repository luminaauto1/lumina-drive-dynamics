import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useDealDeskList } from '@/hooks/dealdesk/useDealDesk';
import type { Deal } from '@/lib/dealdesk/types';
import { DealsTable, isAwaitingFinalize } from '@/components/dealdesk/DealsTable';
import { DeliveryBoard } from '@/components/dealdesk/DeliveryBoard';
import { PayablesView } from '@/components/dealdesk/PayablesView';
import { ReportsView } from '@/components/dealdesk/ReportsView';
import { DealDeskDrawer } from '@/components/dealdesk/DealDeskDrawer';
import { DealsTableSkeleton } from '@/components/dealdesk/DealDeskSkeletons';
import AftersalesLedger from '@/components/dealdesk/AftersalesLedger';
import { useCanSeeDealProfit } from '@/lib/dealdesk/access';

const AdminDealDesk = () => {
  const { isSuperAdmin } = useAuth();
  // Sales agents work deliveries and follow-ups; the money tabs are theirs to
  // neither see nor load (the underlying tables are RLS-blocked for them).
  const canSeeProfit = useCanSeeDealProfit();
  const { data: allDeals = [], isLoading } = useDealDeskList();
  const [openDeal, setOpenDeal] = useState<Deal | null>(null);

  // Auto-created, not-yet-finalized drafts are ADMIN-ONLY. Non-admins never see
  // them anywhere in Deal Desk (list, delivery board, reports). Admins see the
  // full set and get the "Awaiting finalize" filter inside the Deals table.
  const deals = useMemo(
    () => (isSuperAdmin ? allDeals : allDeals.filter((d) => !isAwaitingFinalize(d))),
    [allDeals, isSuperAdmin],
  );

  // Keep the open drawer in sync with refreshed list data (e.g. after Natis save).
  const liveOpen = openDeal ? deals.find((d) => d.id === openDeal.id) || openDeal : null;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> Deal Desk
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Back-office cost sheet, delivery &amp; Natis tracking, and payables — built on your existing finalized deals.
            All figures here are additive; they never change a deal's recorded profit or the Accounting &amp; VAT totals.
          </p>
        </div>

        <Tabs defaultValue="deals">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="deals">Deals</TabsTrigger>
            {canSeeProfit && <TabsTrigger value="ledger">Ledger / Profit</TabsTrigger>}
            <TabsTrigger value="followups">Customer Follow-ups</TabsTrigger>
            <TabsTrigger value="delivery">Delivery &amp; Natis</TabsTrigger>
            {canSeeProfit && <TabsTrigger value="payables">Payables</TabsTrigger>}
            {canSeeProfit && <TabsTrigger value="reports">Reports</TabsTrigger>}
          </TabsList>
          <div className="mt-4">
            {/* While the deal list loads, show a skeleton in place of the data
                tabs; tabs themselves stay interactive so navigation feels instant. */}
            <TabsContent value="deals">
              {isLoading ? <DealsTableSkeleton /> : <DealsTable deals={deals} onOpen={setOpenDeal} canSeeDrafts={isSuperAdmin} />}
            </TabsContent>
            {/* Folded-in Deal Ledger: month-grouped profit table + performance
                bar + commission boards. Reads the same authoritative gross_profit
                column — no second profit number is introduced here. */}
            {canSeeProfit && (
              <TabsContent value="ledger">
                <AftersalesLedger view="ledger" />
              </TabsContent>
            )}
            {/* Folded-in aftersales_records follow-up table. */}
            <TabsContent value="followups">
              <AftersalesLedger view="followups" />
            </TabsContent>
            <TabsContent value="delivery">
              {isLoading ? <DealsTableSkeleton /> : <DeliveryBoard deals={deals} onOpen={setOpenDeal} />}
            </TabsContent>
            {canSeeProfit && <TabsContent value="payables"><PayablesView /></TabsContent>}
            {canSeeProfit && (
              <TabsContent value="reports">
                {isLoading ? <DealsTableSkeleton /> : <ReportsView deals={deals} />}
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      <DealDeskDrawer deal={liveOpen} onClose={() => setOpenDeal(null)} />
    </AdminLayout>
  );
};

export default AdminDealDesk;
