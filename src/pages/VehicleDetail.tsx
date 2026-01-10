import { useState, useEffect } from 'react';
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
  ZoomIn,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/hooks/useWishlist';
import { useVehicle } from '@/hooks/useVehicles';
import { formatPrice, formatMileage, calculateMonthlyPayment } from '@/lib/formatters';
import KineticText from '@/components/KineticText';
import FinanceCalculator from '@/components/FinanceCalculator';
import ImageLightbox from '@/components/ImageLightbox';
import { useTrackEvent } from '@/hooks/useAnalytics';

const VehicleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const trackEvent = useTrackEvent();

  const { data: vehicle, isLoading } = useVehicle(id || '');

  // Track vehicle page view and time on page
  useEffect(() => {
    if (!vehicle || !id) return;
    
    const startTime = Date.now();
    
    // Track page view with vehicle details
    trackEvent.mutate({
      event_type: 'vehicle_view',
      page_path: `/vehicle/${id}`,
      event_data: {
        vehicle_id: id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price,
      },
    });

    // Track time on page when leaving
    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      if (timeSpent > 2) {
        trackEvent.mutate({
          event_type: 'vehicle_time_spent',
          page_path: `/vehicle/${id}`,
          event_data: {
            vehicle_id: id,
            seconds: timeSpent,
            make: vehicle.make,
            model: vehicle.model,
          },
        });
      }
    };
  }, [vehicle?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading vehicle...</div>
      </div>
    );
  }

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
  const monthlyPayment = vehicle.finance_available
    ? calculateMonthlyPayment(vehicle.price)
    : null;

  const images = vehicle.images || [];
  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant || ''}`.trim();
  
  // WhatsApp message based on finance availability
  const whatsappMessage = vehicle.finance_available && monthlyPayment
    ? `Hi, I'm interested in the ${vehicleTitle} for approx ${formatPrice(monthlyPayment)}/pm. Is it still available?`
    : `Hi, I'm interested in the cash deal for ${vehicleTitle} at ${formatPrice(vehicle.price)}. Is it still available?`;
  const whatsappUrl = `https://wa.me/27686017462?text=${encodeURIComponent(whatsappMessage)}`;

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
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const specs = [
    { icon: Calendar, label: 'Year', value: vehicle.year },
    { icon: Gauge, label: 'Mileage', value: formatMileage(vehicle.mileage) },
    { icon: Settings, label: 'Transmission', value: vehicle.transmission },
    { icon: Fuel, label: 'Fuel Type', value: vehicle.fuel_type },
    { icon: Palette, label: 'Color', value: vehicle.color || 'N/A' },
    { icon: Shield, label: 'Service History', value: vehicle.service_history || 'Available' },
  ];

  const nextImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const lightboxPrevImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const lightboxNextImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const openLightbox = () => {
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
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
    image: images,
    color: vehicle.color,
    fuelType: vehicle.fuel_type,
    vehicleTransmission: vehicle.transmission,
  };

  return (
    <>
      <Helmet>
        <title>{vehicleTitle} | Lumina Auto</title>
        <meta
          name="description"
          content={`${vehicleTitle} for ${formatPrice(vehicle.price)}. ${vehicle.description || ''}`}
        />
        <script type="application/ld+json">
          {JSON.stringify(vehicleSchema)}
        </script>
      </Helmet>

      <div className="min-h-screen pt-20">
        {/* Image Gallery */}
        <section className={`relative ${isSold ? 'sold-overlay' : ''}`}>
          <div 
            className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden bg-card cursor-pointer group"
            onClick={openLightbox}
          >
            {images.length > 0 ? (
              images.map((image, index) => (
                <motion.img
                  key={index}
                  src={image}
                  alt={`${vehicleTitle} - Image ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
                  transition={{ duration: 0.5 }}
                />
              ))
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                <span className="text-muted-foreground">No images available</span>
              </div>
            )}

            {/* Navigation Arrows */}
            {images.length > 1 && (
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
            {images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, index) => (
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
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="hidden md:block container mx-auto px-6 py-4">
              <div className="flex gap-3 overflow-x-auto no-scrollbar">
                {images.map((image, index) => (
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
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
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
              {(vehicle.vin || vehicle.engine_code) && (
                <div className="p-6 glass-card rounded-lg space-y-3">
                  {vehicle.vin && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VIN</span>
                      <span className="font-mono">{vehicle.vin}</span>
                    </div>
                  )}
                  {vehicle.engine_code && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Engine Code</span>
                      <span className="font-mono">{vehicle.engine_code}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 space-y-6">
                {/* Price Card - FINANCE FIRST */}
                <div className="p-6 glass-card rounded-xl space-y-4">
                  <div>
                    {/* Monthly Payment - PROMINENT */}
                    {monthlyPayment && !isSold && (
                      <p className="font-display text-4xl font-bold text-foreground mb-1" title="Est. only. Subject to bank approval & interest rates.">
                        {formatPrice(monthlyPayment)}<span className="text-lg">/pm*</span>
                      </p>
                    )}
                    {/* Cash Price - De-emphasized */}
                    <p className="text-lg text-muted-foreground">
                      {formatPrice(vehicle.price)} cash
                    </p>
                    {!vehicle.finance_available && !isSold && (
                      <p className="text-muted-foreground text-sm mt-1">Cash/EFT Only</p>
                    )}
                    {monthlyPayment && !isSold && (
                      <p className="text-xs text-muted-foreground/60 mt-1">*Est. only. Subject to bank approval & interest rates.</p>
                    )}
                  </div>

                  {/* Actions */}
                  {!isSold && !isIncoming && (
                    <div className="space-y-3">
                      <Link to="/finance-application" className="block">
                        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                          Check Affordability
                        </Button>
                      </Link>
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <Button variant="outline" className="w-full gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp Enquiry
                        </Button>
                      </a>
                      <a href="tel:+27686017462" className="block">
                        <Button variant="outline" className="w-full gap-2">
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
                        <Button variant="outline">View Similar Vehicles</Button>
                      </Link>
                    </div>
                  )}

                  {/* Secondary Actions */}
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => toggleWishlist(vehicle.id)}
                    >
                      <Heart
                        className={`w-4 h-4 ${inWishlist ? 'fill-primary text-primary' : ''}`}
                      />
                      {inWishlist ? 'Saved' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>

                {/* Interactive Finance Calculator */}
                {vehicle.finance_available && !isSold && (
                  <FinanceCalculator vehiclePrice={vehicle.price} vehicleYear={vehicle.year} />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Mobile Action Bar */}
        {!isSold && (
          <div className="sticky-action-bar">
            <div className="flex gap-3">
              <a href="tel:+27686017462" className="flex-1">
                <Button variant="outline" className="w-full gap-2 h-12 bg-background/80 backdrop-blur-sm">
                  <Phone className="w-5 h-5" />
                  Call
                </Button>
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full gap-2 h-12 bg-[#25D366] text-white hover:bg-[#25D366]/90">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        images={images}
        currentIndex={currentImageIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        onPrev={lightboxPrevImage}
        onNext={lightboxNextImage}
        title={vehicleTitle}
      />
    </>
  );
};

export default VehicleDetail;
