import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SourcingCard = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/80 via-muted/60 to-muted/40 border border-border hover:border-primary/50 transition-all duration-300"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <pattern id="car-pattern" patternUnits="userSpaceOnUse" width="20" height="20">
            <circle cx="10" cy="10" r="1" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#car-pattern)" />
        </svg>
      </div>

      <div className="relative p-6 h-full flex flex-col justify-between min-h-[340px]">
        {/* Icon Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <HelpCircle className="w-12 h-12 text-primary" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-4">
          <h3 className="font-display text-xl font-semibold">
            Can't find your specific model?
          </h3>
          <p className="text-muted-foreground text-sm">
            We source vehicles from 120+ dealer partners.
          </p>
          <Button asChild variant="outline" className="w-full group/btn">
            <Link to="/sourcing">
              Let Us Source It
              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default SourcingCard;
