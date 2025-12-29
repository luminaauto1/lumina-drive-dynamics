import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Heart, GitCompare, ChevronRight } from 'lucide-react';
import { Vehicle, useWishlist } from '@/hooks/useWishlist';
import { formatPrice, formatMileage, calculateMonthlyPayment } from '@/data/vehicles';

interface VehicleCardProps {
  vehicle: Vehicle;
  onCompare?: (id: string) => void;
  isComparing?: boolean;
}

const VehicleCard = ({ vehicle, onCompare, isComparing }: VehicleCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const cardRef = useRef<HTMLDivElement>(null);

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
  };

  // Image slideshow on hover
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  // Cycle through images on hover
  const handleImageHover = () => {
    if (vehicle.images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % vehicle.images.length);
      }, 800);
      return () => clearInterval(interval);
    }
  };

  const isSold = vehicle.status === 'sold';
  const isIncoming = vehicle.status === 'incoming';
  const inWishlist = isInWishlist(vehicle.id);
  const monthlyPayment = vehicle.financeAvailable
    ? calculateMonthlyPayment(vehicle.price)
    : null;

  return (
    <motion.div
      ref={cardRef}
      className={`vehicle-card relative group ${isSold ? 'sold-overlay' : ''}`}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative overflow-hidden rounded-lg bg-card border border-border">
        {/* Image Container */}
        <div
          className="relative aspect-[16/10] overflow-hidden"
          onMouseEnter={handleImageHover}
        >
          {vehicle.images.map((image, index) => (
            <motion.img
              key={index}
              src={image}
              alt={`${vehicle.make} ${vehicle.model} - Image ${index + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: index === 0 ? 1 : 0 }}
              animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            />
          ))}

          {/* Image Indicators */}
          {vehicle.images.length > 1 && isHovered && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {vehicle.images.map((_, index) => (
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
          {isIncoming && (
            <div className="coming-soon-badge rounded-sm">Coming Soon</div>
          )}

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
          {/* Title */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="font-display text-lg font-semibold leading-tight">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              <p className="text-sm text-muted-foreground">{vehicle.variant}</p>
            </div>
          </div>

          {/* Specs */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span>{formatMileage(vehicle.mileage)}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
            <span>{vehicle.transmission}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
            <span>{vehicle.fuelType}</span>
          </div>

          {/* Price */}
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-2xl font-bold text-foreground">
                {formatPrice(vehicle.price)}
              </p>
              {monthlyPayment && !isSold && (
                <p className="text-sm text-primary">
                  Est. {formatPrice(monthlyPayment)}/pm
                </p>
              )}
              {!vehicle.financeAvailable && !isSold && (
                <p className="text-sm text-muted-foreground">Cash/EFT Only</p>
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
        </div>
      </div>
    </motion.div>
  );
};

export default VehicleCard;
