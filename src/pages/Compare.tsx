import { Helmet } from 'react-helmet-async';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicVehicles, type Vehicle } from '@/hooks/useVehicles';
import { formatPrice, formatMileage, calculateMonthlyPayment } from '@/lib/formatters';
import { getOptimizedImage } from '@/lib/utils';
import KineticText from '@/components/KineticText';

type Row = {
  label: string;
  render: (v: Vehicle) => React.ReactNode;
  show?: (vehicles: Vehicle[]) => boolean;
};

const rows: Row[] = [
  { label: 'Price', render: (v) => formatPrice(v.price) },
  { label: 'Year', render: (v) => v.year },
  { label: 'Mileage', render: (v) => formatMileage(v.mileage) },
  { label: 'Fuel', render: (v) => v.fuel_type || '—' },
  { label: 'Transmission', render: (v) => v.transmission || '—' },
  {
    label: 'Body Type',
    render: (v) => v.body_type || '—',
    show: (vs) => vs.some((v) => v.body_type),
  },
  {
    label: 'Engine / Variant',
    render: (v) => v.variant || v.engine_code || '—',
    show: (vs) => vs.some((v) => v.variant || v.engine_code),
  },
  { label: 'Colour', render: (v) => v.color || '—', show: (vs) => vs.some((v) => v.color) },
  {
    label: 'Finance',
    render: (v) => (v.finance_available ? 'Available' : 'Cash / EFT Only'),
  },
];

const Compare = () => {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];
  const { data: allVehicles = [], isLoading } = usePublicVehicles();

  // Resolve the selected UUIDs against the LIVE inventory, preserving URL order.
  const compareVehicles = ids
    .map((id) => allVehicles.find((v) => v.id === id))
    .filter((v): v is Vehicle => Boolean(v));

  const visibleRows = rows.filter((r) => !r.show || r.show(compareVehicles));

  return (
    <>
      <Helmet><title>Compare Vehicles | Lumina Auto</title></Helmet>
      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6">
          <Link to="/inventory" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to Inventory
          </Link>
          <h1 className="font-display text-4xl font-bold mb-12"><KineticText>Compare Vehicles</KineticText></h1>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading vehicles…
            </div>
          ) : compareVehicles.length >= 2 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-4 text-left"></th>
                    {compareVehicles.map((v) => {
                      const image = v.images?.[0];
                      return (
                        <th key={v.id} className="p-4 text-center align-top">
                          <Link to={`/vehicle/${v.id}`}>
                            {image ? (
                              <img
                                src={getOptimizedImage(image, 600)}
                                alt={`${v.make} ${v.model}`}
                                className="w-full h-32 object-cover rounded-lg mb-3"
                              />
                            ) : (
                              <div className="w-full h-32 rounded-lg mb-3 bg-secondary flex items-center justify-center">
                                <span className="text-sm text-muted-foreground">No image</span>
                              </div>
                            )}
                            <p className="font-display font-semibold">{v.year} {v.make} {v.model}</p>
                            {v.variant && <p className="text-sm text-muted-foreground">{v.variant}</p>}
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <motion.tr key={row.label} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="border-t border-border">
                      <td className="p-4 text-muted-foreground font-medium whitespace-nowrap">{row.label}</td>
                      {compareVehicles.map((v) => (
                        <td key={v.id} className="p-4 text-center font-semibold">
                          {row.render(v)}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                  <tr className="border-t border-border bg-primary/5">
                    <td className="p-4 text-muted-foreground font-medium whitespace-nowrap">Monthly Est.</td>
                    {compareVehicles.map((v) => (
                      <td key={v.id} className="p-4 text-center font-semibold text-primary">
                        {v.finance_available ? `From ${formatPrice(calculateMonthlyPayment(v.price))}/pm` : 'Cash Only'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground/60 mt-4">
                Monthly estimate only. Subject to bank approval and prevailing interest rates.
              </p>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-6">
                {compareVehicles.length === 1
                  ? 'Add at least one more vehicle to compare.'
                  : 'Select at least 2 vehicles to compare from the inventory.'}
              </p>
              <Link to="/inventory"><Button>Browse Inventory</Button></Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Compare;
