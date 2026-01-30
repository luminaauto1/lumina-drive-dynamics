import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRentals, Rental } from '@/hooks/useRentals';
import { formatPrice } from '@/lib/formatters';
import { Plus, Car, User, Banknote, Loader2 } from 'lucide-react';
import AddRentalModal from './AddRentalModal';
import RentalDetailSheet from './RentalDetailSheet';

const RentalFleetTab = () => {
  const { rentals, isLoading } = useRentals();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    maintenance: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    available: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    sold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const activeRentals = rentals.filter(r => r.status === 'active');
  const totalMonthlyIncome = activeRentals.reduce((sum, r) => sum + Number(r.monthly_rent), 0);
  const totalAssetValue = rentals.reduce((sum, r) => sum + Number(r.purchase_price), 0);

  const handleRentalClick = (rental: Rental) => {
    setSelectedRental(rental);
    setDetailSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Income</p>
                <p className="text-2xl font-bold text-green-400">{formatPrice(totalMonthlyIncome)}</p>
              </div>
              <Banknote className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Rentals</p>
                <p className="text-2xl font-bold text-blue-400">{activeRentals.length}</p>
              </div>
              <Car className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fleet Size</p>
                <p className="text-2xl font-bold text-purple-400">{rentals.length}</p>
              </div>
              <Car className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Asset Value</p>
                <p className="text-2xl font-bold text-amber-400">{formatPrice(totalAssetValue)}</p>
              </div>
              <Banknote className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rental Vehicle
        </Button>
      </div>

      {/* Rental Cards Grid */}
      {rentals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Rental Vehicles</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start building your rental fleet by adding your first vehicle.
            </p>
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Vehicle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rentals.map((rental) => (
            <Card 
              key={rental.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleRentalClick(rental)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-medium">{rental.vehicle_make_model}</h3>
                      <p className="text-sm text-muted-foreground">{rental.registration_number}</p>
                    </div>
                  </div>
                  <Badge className={statusColors[rental.status] || statusColors.available}>
                    {rental.status}
                  </Badge>
                </div>

                {rental.renter_name && (
                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{rental.renter_name}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-sm text-muted-foreground">Monthly Rent</span>
                  <span className="font-bold text-green-400">{formatPrice(rental.monthly_rent)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddRentalModal open={addModalOpen} onOpenChange={setAddModalOpen} />
      <RentalDetailSheet 
        rental={selectedRental} 
        open={detailSheetOpen} 
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
};

export default RentalFleetTab;
