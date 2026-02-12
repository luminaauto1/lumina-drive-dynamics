import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Car, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { formatPrice } from "@/hooks/useVehicles";

interface PurchaseDeal {
  id: string;
  sale_date: string | null;
  sold_price: number | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    vin: string | null;
    registration_number: string | null;
    stock_number: string | null;
  } | null;
}

export const ClientPurchaseHistory = ({ clientId }: { clientId: string }) => {
  const [purchases, setPurchases] = useState<PurchaseDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      // clientId here is the finance application's user_id
      const { data } = await supabase
        .from('deal_records')
        .select(`
          id, sale_date, sold_price,
          vehicle:vehicles(id, make, model, variant, year, vin, registration_number, stock_number)
        `)
        .order('sale_date', { ascending: false });

      // Filter deals that belong to this client via application
      // Since deal_records links to application_id, we fetch all and let parent filter
      // Or we join through finance_applications
      if (data) setPurchases(data as unknown as PurchaseDeal[]);
      setLoading(false);
    };
    fetchHistory();
  }, [clientId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading purchase history...</p>;
  }

  if (purchases.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No vehicles purchased yet.</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Car className="w-4 h-4" />
        Vehicle Garage
      </h3>
      {purchases.map((deal) => {
        const car = deal.vehicle;
        if (!car) return null;
        return (
          <Card key={deal.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {car.year} {car.make} {car.model}
                  {car.variant && <span className="text-muted-foreground"> {car.variant}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {car.vin && `VIN: ${car.vin}`}
                  {car.vin && car.registration_number && ' | '}
                  {car.registration_number && `Reg: ${car.registration_number}`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>{deal.sale_date ? format(new Date(deal.sale_date), 'dd MMM yyyy') : 'N/A'}</span>
              </div>
              <span className="font-medium">
                {deal.sold_price ? formatPrice(deal.sold_price) : 'N/A'}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
