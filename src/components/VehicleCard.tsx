import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Heart, GitCompare, ChevronRight, Sparkles } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { formatPrice, formatMileage, calculateMonthlyPayment } from '@/lib/formatters';
import { getOptimizedImage } from '@/lib/utils';
import { useBestFinanceOffer } from '@/hooks/useBestFinanceOffer';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { getMarketingRateConfig } from '@/lib/financeLogic';
import type { Vehicle } from '@/hooks/useVehicles';

interface VehicleCardProps {
  vehicle: Vehicle;
  onCompare?: (id: string) => void;
  isComparing?: boolean;
  isSourcingCard?: boolean;
  isEager?: boolean; // For first 6 images to load eagerly
}

const VehicleCard = ({ vehicle, onCompare, isComparing, isSourcingCard = false, isEager = false }: VehicleCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { data: bestOffer } = useBestFinanceOffer();
  const { data: siteSettings } = useSiteSettings();
  const cardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 3D Tilt Effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-100, 100], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-100, 100], [-8, 8]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
    setCurrentImageIndex(0);
    // Clear interval on leave
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Image slideshow ONLY on hover - no auto-scroll
  const handleMouseEnter = () => {
    setIsHovered(true);
    const images = vehicle.images || [];
    // Start cycling images on hover (slower speed: 1.2s)
    if (images.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 1200);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const isSold = vehicle.status === 'sold';
  const isIncoming = vehicle.status === 'incoming';
  const isSourcingDisplay = vehicle.status === 'sourcing' || (vehicle as any).is_generic_listing;
  const inWishlist = isInWishlist(vehicle.id);
  
  // Calculate monthly payment using MARKETING LOGIC (teaser rates for cards)
  const hasPersonalizedRate = !!bestOffer && !!(bestOffer.interest_rate_linked || bestOffer.interest_rate_fixed);
  const personalizedRate = hasPersonalizedRate 
    ? Math.min(bestOffer.interest_rate_linked || 100, bestOffer.interest_rate_fixed || 100)
    : undefined;
  const personalizedBalloon = bestOffer?.balloon_amount && vehicle.price > 0
    ? Math.round((bestOffer.balloon_amount / vehicle.price) * 100)
    : 0;
  
  // Get marketing rate config - uses teaser rates for cards unless user has personalized rate
  const defaultSiteRate = siteSettings?.default_interest_rate || 13.5;
  const marketingConfig = getMarketingRateConfig(
    vehicle.price,
    defaultSiteRate,
    hasPersonalizedRate,
    personalizedRate
  );
  
  // For sourcing cards, use aggressive balloon from settings (default 35%) to make payment look attractive
  const sourcingBalloon = isSourcingDisplay ? (siteSettings?.default_balloon_percent || 35) : 0;
  
  const monthlyPayment = vehicle.finance_available
    ? calculateMonthlyPayment(vehicle.price, marketingConfig.rate, marketingConfig.term, sourcingBalloon)
    : null;

  const images = vehicle.images || [];

  const handleCardClick = () => {
    if (!isSold) {
      window.location.href = `/vehicle/${vehicle.id}`;
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className={`vehicle-card relative group cursor-pointer ${isSold ? 'sold-overlay' : ''}`}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative overflow-hidden rounded-lg bg-card border border-border">
        {/* Image Container */}
        <div className="relative aspect-[16/10] overflow-hidden">
        {images.length > 0 ? (
            images.map((image, index) => (
              <motion.img
                key={index}
                src={getOptimizedImage(image, 600)}
                alt={`${vehicle.make} ${vehicle.model} - Image ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading={isEager && index === 0 ? "eager" : "lazy"}
                decoding="async"
                initial={{ opacity: index === 0 ? 1 : 0 }}
                animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
            ))
          ) : (
            <div className="absolute inset-0 bg-secondary flex items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}

          {/* Image Indicators */}
          {images.length > 1 && isHovered && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentImageIndex ? 'bg-primary w-4' : 'bg-foreground/50'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            {isIncoming && (
              <div className="coming-soon-badge rounded-sm">Coming Soon</div>
            )}
            
            {/* Sourced X times badge - for sourcing vehicles with sales history (hidden from public) */}
            {/* Badge removed to unify appearance */}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.preventDefault();
                toggleWishlist(vehicle.id);
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                inWishlist
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background/80 backdrop-blur-sm text-foreground hover:bg-primary hover:text-primary-foreground'
              }`}
              data-cursor-hover
            >
              <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current heart-beat' : ''}`} />
            </motion.button>

            {onCompare && !isSold && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  onCompare(vehicle.id);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isComparing
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/80 backdrop-blur-sm text-foreground hover:bg-primary hover:text-primary-foreground'
                }`}
                data-cursor-hover
              >
                <GitCompare className="w-5 h-5" />
              </motion.button>
            )}
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Title - Hide year for sourcing vehicles */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="font-display text-lg font-semibold leading-tight">
                {isSourcingDisplay ? `${vehicle.make} ${vehicle.model}` : `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              </h3>
              <p className="text-sm text-muted-foreground">{vehicle.variant}</p>
            </div>
          </div>

          {/* Specs - Hide year AND mileage for sourcing, show "Your Color Choice" */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            {!isSourcingDisplay && (
              <>
                <span>{formatMileage(vehicle.mileage)}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
              </>
            )}
            <span>{vehicle.transmission}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
            <span>{vehicle.fuel_type}</span>
            {isSourcingDisplay && (
              <>
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                <span className="text-primary">Your Color Choice</span>
              </>
            )}
          </div>

          {/* Price - FINANCE FIRST for sourcing, show Est. Finance instead of cash price */}
          <div className="flex items-end justify-between">
            <div>
              {/* Personalized Rate Badge - only show if vehicle is financeable AND user has podium offer */}
              {vehicle.finance_available && hasPersonalizedRate && !isSold && !isSourcingDisplay && (
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Personalized Rate</span>
                </div>
              )}
              {/* For sourcing vehicles: Show "Est. Finance" label instead of "From" */}
              {isSourcingDisplay && monthlyPayment && !isSold && (
                <p className="font-display text-2xl font-bold text-foreground" title="Est. only. Subject to bank approval & interest rates.">
                  Est. {formatPrice(monthlyPayment)}<span className="text-sm">/pm*</span>
                </p>
              )}
              {/* For regular vehicles: Monthly Payment - LARGEST & BRIGHTEST */}
              {!isSourcingDisplay && monthlyPayment && !isSold && (
                <p className="font-display text-2xl font-bold text-foreground" title="Est. only. Subject to bank approval & interest rates.">
                  From {formatPrice(monthlyPayment)}<span className="text-sm">/pm*</span>
                </p>
              )}
              {/* Cash Price - ONLY show for non-sourcing vehicles */}
              {!isSourcingDisplay && (
                <p className="text-sm text-muted-foreground">
                  {formatPrice(vehicle.price)} cash
                </p>
              )}
              {!vehicle.finance_available && !isSold && !isSourcingDisplay && (
                <p className="text-xs text-muted-foreground">Cash/EFT Only</p>
              )}
            </div>

            {!isSold && (
              <Link
                to={`/vehicle/${vehicle.id}`}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                data-cursor-hover
              >
                View Details
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          {/* Disclaimer */}
          {monthlyPayment && !isSold && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">*Est. only. Subject to bank approval.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default VehicleCard;
