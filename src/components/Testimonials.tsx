import { motion } from 'framer-motion';
import { Star, ExternalLink } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface Testimonial { name?: string; text?: string; rating?: number; location?: string }

/**
 * Social-proof section. Data-driven so we never fabricate reviews:
 *  - settings.testimonials: array of { name, text, rating, location }
 *  - settings.google_reviews_url + settings.google_rating: optional Google badge
 * Renders nothing until at least one real source is configured in admin settings.
 */
const Testimonials = () => {
  const { data: settings } = useSiteSettings();
  const list: Testimonial[] = Array.isArray((settings as any)?.testimonials) ? (settings as any).testimonials : [];
  const googleUrl = (settings as any)?.google_reviews_url || '';
  const googleRating = Number((settings as any)?.google_rating) || 0;

  if (list.length === 0 && !googleUrl) return null;

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">What our customers say</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold">Trusted by drivers across South Africa</h2>
          {googleRating > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-5 h-5 ${i < Math.round(googleRating) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{googleRating.toFixed(1)} on Google</span>
            </div>
          )}
        </div>

        {list.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {list.slice(0, 6).map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl border border-border bg-card"
              >
                <div className="flex mb-3">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className={`w-4 h-4 ${s < (t.rating ?? 5) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4">“{t.text}”</p>
                <p className="text-sm font-semibold">{t.name}{t.location ? ` · ${t.location}` : ''}</p>
              </motion.div>
            ))}
          </div>
        )}

        {googleUrl && (
          <div className="text-center mt-10">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium">
              Read all our Google reviews <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
