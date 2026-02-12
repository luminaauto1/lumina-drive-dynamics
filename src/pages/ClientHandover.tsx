import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Star, Download } from "lucide-react";

const ClientHandover = () => {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeal = async () => {
      const { data } = await (supabase as any)
        .from('deal_records')
        .select('*, application:finance_applications(first_name, last_name, vehicles:vehicles(make, model, year))')
        .eq('id', dealId)
        .maybeSingle();
      if (data) setDeal(data);
      setLoading(false);
    };
    fetchDeal();
  }, [dealId]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!deal) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-muted-foreground text-lg">Link expired or invalid.</p>
    </div>
  );

  const clientName = deal.application?.first_name || "Valued Client";
  const vehicle = deal.application?.vehicles;
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
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2"
                >
                  <Download className="w-4 h-4" />
                </a>
              </Card>
            ))}
          </div>
        )}

        {/* REVIEW LINKS */}
        <div className="text-center mt-16 space-y-4">
          <h2 className="text-2xl font-bold">Love the service?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your review helps us grow and helps others find their dream cars. We would appreciate a moment of your time.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Button
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
              onClick={() => window.open('https://g.page/r/YOUR_GOOGLE_LINK', '_blank')}
            >
              <Star className="w-4 h-4 mr-2" />
              Review on Google
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
              onClick={() => window.open('https://www.trustpilot.com/review/luminaauto.co.za', '_blank')}
            >
              <Star className="w-4 h-4 mr-2" />
              Review on Trustpilot
            </Button>
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
