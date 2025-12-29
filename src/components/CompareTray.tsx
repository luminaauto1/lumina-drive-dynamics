import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { vehicles, formatPrice, formatMileage, calculateMonthlyPayment } from '@/data/vehicles';
import { Button } from '@/components/ui/button';

interface CompareTrayProps {
  compareList: string[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const CompareTray = ({ compareList, onRemove, onClear }: CompareTrayProps) => {
  const compareVehicles = compareList.map((id) =>
    vehicles.find((v) => v.id === id)
  ).filter(Boolean);

  if (compareList.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="compare-tray rounded-2xl border border-border p-4 shadow-2xl"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-primary">
            <GitCompare className="w-5 h-5" />
            <span className="font-semibold text-sm">Compare</span>
          </div>

          <div className="flex items-center gap-3">
            {compareVehicles.map((vehicle) => (
              <motion.div
                key={vehicle!.id}
                layout
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="relative"
              >
                <img
                  src={vehicle!.images[0]}
                  alt={`${vehicle!.make} ${vehicle!.model}`}
                  className="w-16 h-12 object-cover rounded-md"
                />
                <button
                  onClick={() => onRemove(vehicle!.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: 3 - compareList.length }).map((_, i) => (
              <div
                key={i}
                className="w-16 h-12 rounded-md border-2 border-dashed border-border flex items-center justify-center"
              >
                <span className="text-xs text-muted-foreground">+</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="text-xs"
            >
              Clear
            </Button>
            {compareList.length >= 2 && (
              <Link to={`/compare?ids=${compareList.join(',')}`}>
                <Button size="sm" className="text-xs bg-gradient-gold text-primary-foreground">
                  Compare Now
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CompareTray;
