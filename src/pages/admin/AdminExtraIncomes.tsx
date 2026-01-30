import AdminLayout from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, Package } from 'lucide-react';
import RentalFleetTab from '@/components/admin/RentalFleetTab';
import ServicesPartsTab from '@/components/admin/ServicesPartsTab';

const AdminExtraIncomes = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Extra Incomes</h1>
          <p className="text-muted-foreground">
            Manage rental fleet and track additional income streams
          </p>
        </div>

        <Tabs defaultValue="rentals" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="rentals" className="gap-2">
              <Car className="h-4 w-4" />
              Rental Fleet
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Package className="h-4 w-4" />
              Services & Parts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rentals">
            <RentalFleetTab />
          </TabsContent>

          <TabsContent value="services">
            <ServicesPartsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminExtraIncomes;
