import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Gauge, Fuel, Palette, Settings, Shield, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWishlist } from "@/hooks/useWishlist";
import { useVehicle } from "@/hooks/useVehicles";
import { formatPrice, formatMileage, calculateMonthlyPayment } from "@/lib/formatters";
import { getOptimizedImage } from "@/lib/utils";
import { useBestFinanceOffer } from "@/hooks/useBestFinanceOffer";
import KineticText from "@/components/KineticText";
import FinanceCalculator from "@/components/FinanceCalculator";
import ImageLightbox from "@/components/ImageLightbox";
import { useTrackEvent } from "@/hooks/useAnalytics";

const VehicleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { data: bestOffer } = useBestFinanceOffer();
  const trackEvent = useTrackEvent();

  const { data: vehicleData, isLoading } = useVehicle(id || "");

  // Cast vehicle to 'any' to bypass strict JSON/Type checks for new columns
  const vehicle = vehicleData as any;

  // Handle Variant Selection
  useEffect(() => {
    if (vehicle?.variants && Array.isArray(vehicle.variants) && vehicle.variants.length > 0) {
      setSelectedVariant(vehicle.variants[0]);
    }
  }, [vehicle]);

  // Track page view
  useEffect(() => {
    if (!vehicle || !id) return;
    const startTime = Date.now();
    trackEvent.mutate({
      event_type: "vehicle_view",
      page_path: `/vehicle/${id}`,
      event_data: { vehicle_id: id, make: vehicle.make, model: vehicle.model, price: vehicle.price },
    });
    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      if (timeSpent > 2) {
        trackEvent.mutate({
          event_type: "vehicle_time_spent",
          page_path: `/vehicle/${id}`,
          event_data: { vehicle_id: id, seconds: timeSpent },
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

  // --- VARIABLES ---
  const isSold = vehicle.status === "sold";
  const isSourcing = vehicle.status === "sourcing" || vehicle.is_sourcing_example;
  const variants = (vehicle.variants as any[]) || [];

  const displayPrice = selectedVariant ? Number(selectedVariant.price) : vehicle.price;
  const displayTitle = selectedVariant
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${selectedVariant.name}`
    : `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant || ""}`.trim();

  // Personalized Finance Logic
  const hasPersonalizedRate = !!bestOffer && (bestOffer.interest_rate_linked || bestOffer.interest_rate_fixed);
  const personalizedRate = hasPersonalizedRate
    ? Math.min(bestOffer.interest_rate_linked || 100, bestOffer.interest_rate_fixed || 100)
    : undefined;

  const monthlyPayment = vehicle.finance_available
    ? calculateMonthlyPayment(displayPrice, personalizedRate || 13.25, 72, 0)
    : null;

  const images = vehicle.images || [];

  // WhatsApp Message
  const whatsappMessage =
    vehicle.finance_available && monthlyPayment
      ? `Hi, I'm interested in the ${displayTitle} for approx ${formatPrice(monthlyPayment)}/pm. Is it available?`
      : `Hi, I'm interested in the cash deal for ${displayTitle}. Is it available?`;
  const whatsappUrl = `https://wa.me/27686017462?text=${encodeURIComponent(whatsappMessage)}`;

  // Handlers
  const nextImage = () => images.length > 0 && setCurrentImageIndex((p) => (p + 1) % images.length);
  const prevImage = () => images.length > 0 && setCurrentImageIndex((p) => (p - 1 + images.length) % images.length);

  const specs = [
    { icon: Calendar, label: "Year", value: vehicle.year },
    { icon: Gauge, label: "Mileage", value: formatMileage(vehicle.mileage) },
    { icon: Settings, label: "Transmission", value: vehicle.transmission },
    { icon: Fuel, label: "Fuel Type", value: vehicle.fuel_type },
    { icon: Palette, label: "Color", value: vehicle.color || "N/A" },
    { icon: Shield, label: "History", value: vehicle.service_history || "Available" },
  ];

  return (
    <>
      <Helmet>
        <title>{displayTitle} | Lumina Auto</title>
        <meta name="description" content={`${displayTitle}. ${vehicle.description || ""}`} />
      </Helmet>

      <div className="min-h-screen pt-20">
        {/* --- IMAGE GALLERY --- */}
        <section className={`relative ${isSold ? "sold-overlay" : ""}`}>
          <div
            className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden bg-card cursor-pointer group"
            onClick={() => setLightboxOpen(true)}
          >
            {images.length > 0 ? (
              images.map((image: string, index: number) => (
                <motion.img
                  key={index}
                  src={getOptimizedImage(image, 1200)}
                  alt={`Image ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
                  transition={{ duration: 0.5 }}
                />
              ))
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                <span className="text-muted-foreground">No images</span>
              </div>
            )}

            {/* Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm z-10"
                >
                  <ChevronLeft />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm z-10"
                >
                  <ChevronRight />
                </button>
              </>
            )}
            {/* Dots */}
            {images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {images.map((_: any, i: number) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? "bg-white w-6" : "bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* --- MAIN CONTENT --- */}
        <section className="container mx-auto px-4 md:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
            {/* Left: Info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-white mb-4"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
                  <KineticText>{displayTitle}</KineticText>
                </h1>

                {/* Variant Selector (If Sourcing) */}
                {variants.length > 0 && (
                  <div className="mt-4 max-w-sm">
                    <label className="text-sm text-muted-foreground mb-2 block">Select Spec/Variant</label>
                    <Select
                      value={selectedVariant?.name}
                      onValueChange={(val) => {
                        const v = variants.find((v: any) => v.name === val);
                        if (v) setSelectedVariant(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose Variant" />
                      </SelectTrigger>
                      <SelectContent>
                        {variants.map((v: any, idx: number) => (
                          <SelectItem key={idx} value={v.name}>
                            {v.name} - {formatPrice(v.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {specs.map((spec) => (
                  <div key={spec.label} className="p-4 glass-card rounded-lg border border-white/5">
                    <spec.icon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground uppercase">{spec.label}</p>
                    <p className="font-semibold">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {vehicle.description && (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-semibold">About This Vehicle</h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{vehicle.description}</p>
                </div>
              )}
            </div>

            {/* Right: Sidebar / Finance */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Price Card */}
                <div className="p-6 glass-card rounded-xl border border-white/10 space-y-4">
                  {!isSourcing && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider">Cash Price</p>
                      <div className="text-3xl font-bold text-white">{formatPrice(displayPrice)}</div>
                    </div>
                  )}

                  {vehicle.finance_available && monthlyPayment ? (
                    <div className="pt-2 border-t border-white/10">
                      {hasPersonalizedRate && (
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                            Personalized Rate
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">Estimated Finance</p>
                      <div className="text-2xl font-bold text-primary">From {formatPrice(monthlyPayment)}/pm</div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-sm text-amber-500 font-semibold">Cash Only Deal</p>
                    </div>
                  )}

                  <div className="grid gap-3 pt-4">
                    <Button className="w-full h-12 text-lg" onClick={() => window.open(whatsappUrl, "_blank")}>
                      Enquire on WhatsApp
                    </Button>
                    <Link to="/apply">
                      <Button variant="outline" className="w-full">
                        Apply for Finance
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Calculator */}
                {vehicle.finance_available && (
                  <FinanceCalculator vehiclePrice={displayPrice} vehicleYear={vehicle.year} />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={images.map((img: string) => getOptimizedImage(img, 1600))}
          currentIndex={currentImageIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}
    </>
  );
};

export default VehicleDetail;
