import { useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useDealDeskList } from '@/hooks/dealdesk/useDealDesk';
import type { Deal } from '@/lib/dealdesk/types';
import { DealsTable } from '@/components/dealdesk/DealsTable';
import { DeliveryBoard } from '@/components/dealdesk/DeliveryBoard';
import { PayablesView } from '@/components/dealdesk/PayablesView';
import { ReportsView } from '@/components/dealdesk/ReportsView';
import { NatisSettings } from '@/components/dealdesk/NatisSettings';
import { DealDeskDrawer } from '@/components/dealdesk/DealDeskDrawer';

const AdminDealDesk = () => {
  const { isSuperAdmin } = useAuth();
  const { data: deals = [], isLoading } = useDealDeskList();
  const [openDeal, setOpenDeal] = useState<Deal | null>(null);

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

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading deals…
          </div>
        ) : (
          <Tabs defaultValue="deals">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="delivery">Delivery &amp; Natis</TabsTrigger>
              <TabsTrigger value="payables">Payables</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="deals"><DealsTable deals={deals} onOpen={setOpenDeal} /></TabsContent>
              <TabsContent value="delivery"><DeliveryBoard deals={deals} onOpen={setOpenDeal} /></TabsContent>
              <TabsContent value="payables"><PayablesView /></TabsContent>
              <TabsContent value="reports"><ReportsView deals={deals} /></TabsContent>
              <TabsContent value="settings"><NatisSettings canEdit={isSuperAdmin} /></TabsContent>
            </div>
          </Tabs>
        )}
      </div>

      <DealDeskDrawer deal={liveOpen} onClose={() => setOpenDeal(null)} />
    </AdminLayout>
  );
};

export default AdminDealDesk;
