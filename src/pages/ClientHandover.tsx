import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Star, Download, Facebook, Instagram, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ClientHandover = () => {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!dealId) return;

      const settingsRes = await supabase.from('public_site_settings' as any).select('*').limit(1).maybeSingle();
      if (settingsRes.data) setSettings(settingsRes.data);

      try {
        const { publicApiHeaders } = await import('@/lib/publicApi');
        const { data, error } = await supabase.functions.invoke('get-handover-data', {
          body: { dealId },
          headers: publicApiHeaders(),
        });

        if (error || !data) {
          setErrorMsg(error?.message || "Failed to load handover data");
        } else {
          setDeal(data);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load");
      }

      setLoading(false);
    };
    fetchData();
  }, [dealId]);

  const downloadPhoto = async (url: string, index: number) => {
    setDownloadingIdx(index);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Lumina_Delivery_${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
      toast.success("Photo downloaded! Attach it to your review 📸");
    } catch (err) {
      window.open(url, '_blank');
    } finally {
      setDownloadingIdx(null);
    }
  };

  const downloadAllPhotos = async (photos: string[]) => {
    toast.info("Downloading all photos...");
    for (let i = 0; i < photos.length; i++) {
      await downloadPhoto(photos[i], i);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!deal) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-center px-6">
      <div>
        <p className="text-muted-foreground text-lg mb-2">Link expired or invalid.</p>
        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
      </div>
    </div>
  );

  const clientName = deal.client_first_name || "Valued Client";
  const vehicle = deal.vehicle;
  const carName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "New Ride";
  const photos: string[] = deal.delivery_photos || [];

  const reviewLinks = [
    { key: 'google_review_url', label: 'Google Review', icon: Star, bg: 'bg-yellow-500 hover:bg-yellow-600', text: 'text-black', priority: true },
    { key: 'trustpilot_url', label: 'Trustpilot', icon: Star, bg: 'bg-emerald-600 hover:bg-emerald-700', text: 'text-white', priority: true },
    { key: 'facebook_url', label: 'Facebook', icon: Facebook, bg: 'bg-blue-600 hover:bg-blue-700', text: 'text-white', priority: true },
    { key: 'hellopeter_url', label: 'HelloPeter', icon: ExternalLink, bg: 'bg-teal-600 hover:bg-teal-700', text: 'text-white', priority: false },
    { key: 'instagram_url', label: 'Instagram', icon: Instagram, bg: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600', text: 'text-white', priority: false },
  ];

  const activeReviews = reviewLinks.filter(r => settings?.[r.key]);

  return (
    <div className="min-h-screen bg-black text-foreground">
      {/* HERO */}
      <div className="relative h-[55vh] min-h-[380px] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black z-10" />
        {photos[0] && (
          <img src={photos[0]} alt="Delivery" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-20 px-6 pb-10 w-full max-w-4xl mx-auto"
        >
          <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-2">Welcome to the family</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Congratulations, {clientName}!
          </h1>
          <p className="text-lg text-zinc-300">
            On your <span className="text-primary font-semibold">{carName}</span>
          </p>
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto px-4">

        {/* ★ REVIEW SECTION — TOP PRIORITY */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="py-12 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Your delivery is complete</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-3">Rate Your Experience</h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Your review helps other buyers find their dream cars. Download your photo below and attach it to your review!
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 mb-4">
            {activeReviews.filter(r => r.priority).map((review) => {
              const Icon = review.icon;
              return (
                <Button
                  key={review.key}
                  size="lg"
                  className={`${review.bg} ${review.text} font-bold text-base px-8 py-6 rounded-xl shadow-lg transition-transform hover:scale-105`}
                  onClick={() => window.open(settings[review.key], '_blank')}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {review.label}
                </Button>
              );
            })}
          </div>

          {activeReviews.filter(r => !r.priority).length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {activeReviews.filter(r => !r.priority).map((review) => {
                const Icon = review.icon;
                return (
                  <Button
                    key={review.key}
                    variant="outline"
                    size="lg"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl"
                    onClick={() => window.open(settings[review.key], '_blank')}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {review.label}
                  </Button>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* PHOTO GALLERY */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="pb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Your Delivery Photos</h3>
            {photos.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => downloadAllPhotos(photos)}
              >
                <Download className="w-4 h-4 mr-1" />
                Download All
              </Button>
            )}
          </div>

          {photos.length === 0 ? (
            <p className="text-center text-muted-foreground text-lg py-12">Photos coming soon...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((url: string, idx: number) => (
                <Card key={idx} className="overflow-hidden group relative bg-zinc-900 border-zinc-800 rounded-xl">
                  <img src={url} alt={`Delivery ${idx + 1}`} className="w-full h-64 object-cover transition-transform group-hover:scale-105 duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                    <Button
                      size="sm"
                      onClick={() => downloadPhoto(url, idx)}
                      disabled={downloadingIdx === idx}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black hover:bg-zinc-200 font-semibold rounded-lg"
                    >
                      {downloadingIdx === idx ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Download
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </motion.section>

        {/* FOOTER */}
        <div className="text-center pb-10 pt-6 border-t border-zinc-800">
          <p className="text-muted-foreground font-semibold">Lumina Auto | Premium Pre-Owned</p>
          <p className="text-sm text-muted-foreground mt-1">Thank you for choosing us.</p>
        </div>
      </div>
    </div>
  );
};

export default ClientHandover;
