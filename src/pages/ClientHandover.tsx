import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Star, Download, Facebook, Instagram } from "lucide-react";
import { toast } from "sonner";

const ClientHandover = () => {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!dealId) return;

      // Fetch settings publicly (allowed by RLS)
      const settingsRes = await supabase.from('site_settings').select('*').limit(1).single();
      if (settingsRes.data) setSettings(settingsRes.data);

      // Use edge function for deal data (avoids needing anon access to finance_applications)
      try {
        const { data, error } = await supabase.functions.invoke('get-handover-data', {
          body: { dealId },
        });

        if (error || !data) {
          console.error("Handover fetch error:", error?.message);
          setErrorMsg(error?.message || "Failed to load handover data");
        } else {
          setDeal(data);
        }
      } catch (err: any) {
        console.error("Handover fetch error:", err);
        setErrorMsg(err.message || "Failed to load");
      }

      setLoading(false);
    };
    fetchData();
  }, [dealId]);

  const downloadPhoto = async (url: string, index: number) => {
    try {
      toast.info("Downloading...");
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Lumina_Delivery_${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      window.open(url, '_blank');
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
        <p className="text-xs text-zinc-600 mt-2">ID: {dealId}</p>
      </div>
    </div>
  );

  const clientName = deal.client_first_name || "Valued Client";
  const vehicle = deal.vehicle;
  const carName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "New Ride";
  const photos: string[] = deal.delivery_photos || [];

  return (
    <div className="min-h-screen bg-black text-foreground">
      {/* HERO SECTION */}
      <div className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black z-10" />
        {photos[0] && (
          <img src={photos[0]} alt="Delivery" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="relative z-20 text-center px-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-3">
            Congratulations, {clientName}!
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            On your <span className="text-primary font-semibold">{carName}</span>
          </p>
        </div>
      </div>

      {/* GALLERY */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {photos.length === 0 ? (
          <p className="text-center text-muted-foreground text-lg">Photos coming soon...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((url: string, idx: number) => (
              <Card key={idx} className="overflow-hidden group relative bg-zinc-900 border-zinc-800">
                <img src={url} alt={`Delivery ${idx + 1}`} className="w-full h-64 object-cover" />
                <button
                  onClick={() => downloadPhoto(url, idx)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2 text-white hover:bg-black/80"
                >
                  <Download className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        )}

        {/* REVIEW LINKS */}
        <div className="text-center mt-16 space-y-4">
          <h2 className="text-2xl font-bold">Share your experience</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your review helps us grow and helps others find their dream cars.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {(settings as any)?.trustpilot_url && (
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={() => window.open((settings as any).trustpilot_url, '_blank')}
              >
                <Star className="w-4 h-4 mr-2" />
                Trustpilot
              </Button>
            )}
            {settings?.google_review_url && (
              <Button
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                onClick={() => window.open(settings.google_review_url, '_blank')}
              >
                <Star className="w-4 h-4 mr-2" />
                Google Review
              </Button>
            )}
            {settings?.hellopeter_url && (
              <Button
                size="lg"
                variant="outline"
                className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
                onClick={() => window.open(settings.hellopeter_url, '_blank')}
              >
                <Star className="w-4 h-4 mr-2" />
                HelloPeter
              </Button>
            )}
            {settings?.facebook_url && (
              <Button
                size="lg"
                variant="outline"
                className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                onClick={() => window.open(settings.facebook_url, '_blank')}
              >
                <Facebook className="w-4 h-4 mr-2" />
                Facebook
              </Button>
            )}
            {settings?.instagram_url && (
              <Button
                size="lg"
                variant="outline"
                className="border-pink-500 text-pink-500 hover:bg-pink-500/10"
                onClick={() => window.open(settings.instagram_url, '_blank')}
              >
                <Instagram className="w-4 h-4 mr-2" />
                Instagram
              </Button>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center mt-20 pb-8 border-t border-zinc-800 pt-8">
          <p className="text-muted-foreground font-semibold">Lumina Auto | Premium Pre-Owned</p>
          <p className="text-sm text-muted-foreground mt-1">Thank you for your business.</p>
        </div>
      </div>
    </div>
  );
};

export default ClientHandover;
