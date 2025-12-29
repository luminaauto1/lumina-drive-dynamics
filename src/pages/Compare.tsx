import { Helmet } from 'react-helmet-async';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { vehicles, formatPrice, formatMileage, calculateMonthlyPayment } from '@/data/vehicles';
import KineticText from '@/components/KineticText';

const Compare = () => {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids')?.split(',') || [];
  const compareVehicles = ids.map((id) => vehicles.find((v) => v.id === id)).filter(Boolean);

  const specs = ['year', 'mileage', 'price', 'transmission', 'fuelType', 'color'] as const;
  const labels: Record<string, string> = { year: 'Year', mileage: 'Mileage', price: 'Price', transmission: 'Transmission', fuelType: 'Fuel', color: 'Color' };

  return (
    <>
      <Helmet><title>Compare Vehicles | Lumina Auto</title></Helmet>
      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6">
          <Link to="/inventory" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to Inventory
          </Link>
          <h1 className="font-display text-4xl font-bold mb-12"><KineticText>Compare Vehicles</KineticText></h1>
          
          {compareVehicles.length >= 2 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-4 text-left"></th>
                    {compareVehicles.map((v) => (
                      <th key={v!.id} className="p-4 text-center">
                        <img src={v!.images[0]} alt={v!.model} className="w-full h-32 object-cover rounded-lg mb-3" />
                        <p className="font-display font-semibold">{v!.year} {v!.make} {v!.model}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {specs.map((spec) => (
                    <motion.tr key={spec} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="border-t border-border">
                      <td className="p-4 text-muted-foreground font-medium">{labels[spec]}</td>
                      {compareVehicles.map((v) => (
                        <td key={v!.id} className="p-4 text-center font-semibold">
                          {spec === 'price' ? formatPrice(v!.price) : spec === 'mileage' ? formatMileage(v!.mileage) : v![spec]}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                  <tr className="border-t border-border bg-primary/5">
                    <td className="p-4 text-muted-foreground font-medium">Monthly Est.</td>
                    {compareVehicles.map((v) => (
                      <td key={v!.id} className="p-4 text-center font-semibold text-primary">
                        {v!.financeAvailable ? `${formatPrice(calculateMonthlyPayment(v!.price))}/pm` : 'Cash Only'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-6">Select at least 2 vehicles to compare.</p>
              <Link to="/inventory"><Button>Browse Inventory</Button></Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Compare;
