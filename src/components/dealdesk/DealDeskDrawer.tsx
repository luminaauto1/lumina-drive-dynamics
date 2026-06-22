import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Deal } from '@/lib/dealdesk/types';
import { StatusBadge } from './badges';
import { OverviewTab } from './tabs/OverviewTab';
import { CostSheetTab } from './tabs/CostSheetTab';
import { ChecklistTab } from './tabs/ChecklistTab';
import { DeliveryTab } from './tabs/DeliveryTab';
import { ExpensesTab } from './tabs/ExpensesTab';
import { ActivityTab } from './tabs/ActivityTab';

export function DealDeskDrawer({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  if (!deal) return null;
  return (
    <Sheet open={!!deal} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{deal.client_name || 'Deal'}</span>
            <StatusBadge status={deal.deal_status} />
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{deal.vehicle_make_model || '—'}{deal.vehicle_year ? ` · ${deal.vehicle_year}` : ''}</p>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="flex w-full flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="costsheet">Cost Sheet</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="delivery">Delivery &amp; Natis</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="overview"><OverviewTab deal={deal} /></TabsContent>
            <TabsContent value="costsheet"><CostSheetTab deal={deal} /></TabsContent>
            <TabsContent value="checklist"><ChecklistTab deal={deal} /></TabsContent>
            <TabsContent value="delivery"><DeliveryTab deal={deal} /></TabsContent>
            <TabsContent value="expenses"><ExpensesTab deal={deal} /></TabsContent>
            <TabsContent value="activity"><ActivityTab deal={deal} /></TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
