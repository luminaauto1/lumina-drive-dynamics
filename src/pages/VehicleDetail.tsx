import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Phone,
  MessageCircle,
  Calendar,
  Gauge,
  Fuel,
  Palette,
  Settings,
  Shield,
  Bell,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/hooks/useWishlist';
import { vehicles, formatPrice, formatMileage, calculateMonthlyPayment } from '@/data/vehicles';
import KineticText from '@/components/KineticText';
import FinanceCalculator from '@/components/FinanceCalculator';

const VehicleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { isInWishlist, toggleWishlist } = useWishlist();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-4">Vehicle Not Found</h1>
          <Link to="/inventory">
            <Button>Back to Inventory</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isSold = vehicle.status === 'sold';
  const isIncoming = vehicle.status === 'incoming';
  const inWishlist = isInWishlist(vehicle.id);
  const monthlyPayment = vehicle.financeAvailable
    ? calculateMonthlyPayment(vehicle.price)
    : null;

  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`;
  const whatsappMessage = `Hi Albert, I am interested in the [${vehicleTitle}] listed for [${formatPrice(vehicle.price)}]. Is it still available?`;
  const whatsappUrl = `https://wa.me/27110001234?text=${encodeURIComponent(whatsappMessage)}`;

  const handleShare = async () => {
    const shareData = {
      title: vehicleTitle,
      text: `Check out this ${vehicleTitle} for ${formatPrice(vehicle.price)}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const specs = [
    { icon: Calendar, label: 'Year', value: vehicle.year },
    { icon: Gauge, label: 'Mileage', value: formatMileage(vehicle.mileage) },
    { icon: Settings, label: 'Transmission', value: vehicle.transmission },
    { icon: Fuel, label: 'Fuel Type', value: vehicle.fuelType },
    { icon: Palette, label: 'Color', value: vehicle.color },
    { icon: Shield, label: 'Service History', value: vehicle.serviceHistory || 'Available' },
  ];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % vehicle.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + vehicle.images.length) % vehicle.images.length);
  };

  // SEO Schema
  const vehicleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: vehicleTitle,
    brand: { '@type': 'Brand', name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: vehicle.year,
    mileageFromOdometer: {
      '@type': 'QuantitativeValue',
      value: vehicle.mileage,
      unitCode: 'KMT',
    },
    offers: {
      '@type': 'Offer',
      price: vehicle.price,
      priceCurrency: 'ZAR',
      availability: isSold
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
    },
    image: vehicle.images,
    color: vehicle.color,
    fuelType: vehicle.fuelType,
    vehicleTransmission: vehicle.transmission,
  };

  return (
    <>
      <Helmet>
        <title>{vehicleTitle} | Lumina Auto</title>
        <meta
          name="description"
          content={`${vehicleTitle} for ${formatPrice(vehicle.price)}. ${vehicle.description}`}
        />
        <script type="application/ld+json">
          {JSON.stringify(vehicleSchema)}
        </script>
      </Helmet>

      <div className="min-h-screen pt-20">
        {/* Image Gallery */}
        <section className={`relative ${isSold ? 'sold-overlay' : ''}`}>
          <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden bg-card">
            {vehicle.images.map((image, index) => (
              <motion.img
                key={index}
                src={image}
                alt={`${vehicleTitle} - Image ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              />
            ))}

            {/* Navigation Arrows */}
            {vehicle.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                  data-cursor-hover
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                  data-cursor-hover
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Badges */}
            {isIncoming && (
              <div className="coming-soon-badge rounded-sm absolute top-6 left-6">
                Coming Soon
              </div>
            )}

            {/* Image Dots */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {vehicle.images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    index === currentImageIndex
                      ? 'bg-primary w-8'
                      : 'bg-foreground/50 hover:bg-foreground/80'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Thumbnail Strip */}
          <div className="hidden md:block container mx-auto px-6 py-4">
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {vehicle.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentImageIndex
                      ? 'border-primary'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Header */}
              <div>
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                  data-cursor-hover
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
                  <KineticText>{vehicleTitle}</KineticText>
                </h1>
                <p className="text-muted-foreground">{vehicle.variant}</p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="p-4 glass-card rounded-lg"
                  >
                    <spec.icon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {spec.label}
                    </p>
                    <p className="font-semibold">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {vehicle.description && (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-semibold">About This Vehicle</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {vehicle.description}
                  </p>
                </div>
              )}

              {/* VIN & Engine Code */}
              {(vehicle.vin || vehicle.engineCode) && (
                <div className="p-6 glass-card rounded-lg space-y-3">
                  {vehicle.vin && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VIN</span>
                      <span className="font-mono">{vehicle.vin}</span>
                    </div>
                  )}
                  {vehicle.engineCode && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Engine Code</span>
                      <span className="font-mono">{vehicle.engineCode}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 space-y-6">
                {/* Price Card */}
                <div className="p-6 glass-card rounded-xl space-y-4">
                  <div>
                    <p className="text-3xl font-bold">
                      {formatPrice(vehicle.price)}
                    </p>
                    {monthlyPayment && !isSold && (
                      <p className="text-primary font-medium">
                        Est. {formatPrice(monthlyPayment)}/pm
                      </p>
                    )}
                    {!vehicle.financeAvailable && !isSold && (
                      <p className="text-muted-foreground">Cash/EFT Only</p>
                    )}
                  </div>

                  {/* Actions */}
                  {!isSold && !isIncoming && (
                    <div className="space-y-3">
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                          <MessageCircle className="w-5 h-5" />
                          Enquire on WhatsApp
                        </Button>
                      </a>
                      <a href="tel:+27110001234" className="block">
                        <Button variant="outline" className="w-full gap-2 border-white/20 hover:bg-white/5">
                          <Phone className="w-5 h-5" />
                          Call Now
                        </Button>
                      </a>
                    </div>
                  )}

                  {isIncoming && (
                    <Button className="w-full gap-2 bg-primary text-primary-foreground">
                      <Bell className="w-5 h-5" />
                      Notify Me When Available
                    </Button>
                  )}

                  {isSold && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-3">This vehicle has been sold</p>
                      <Link to="/inventory">
                        <Button variant="outline" className="border-white/20 hover:bg-white/5">View Similar Vehicles</Button>
                      </Link>
                    </div>
                  )}

                  {/* Secondary Actions */}
                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 border-white/20 hover:bg-white/5"
                      onClick={() => toggleWishlist(vehicle.id)}
                    >
                      <Heart
                        className={`w-4 h-4 ${inWishlist ? 'fill-primary text-primary' : ''}`}
                      />
                      {inWishlist ? 'Saved' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 border-white/20 hover:bg-white/5"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>

                {/* Interactive Finance Calculator */}
                {vehicle.financeAvailable && !isSold && (
                  <FinanceCalculator vehiclePrice={vehicle.price} />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Mobile Action Bar */}
        {!isSold && (
          <div className="sticky-action-bar">
            <div className="flex gap-3">
              <a href="tel:+27110001234" className="flex-1">
                <Button variant="outline" className="w-full gap-2 h-12 border-white/20 bg-background/80 backdrop-blur-sm">
                  <Phone className="w-5 h-5" />
                  Call
                </Button>
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full gap-2 h-12 bg-primary text-primary-foreground">
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default VehicleDetail;
