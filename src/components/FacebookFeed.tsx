import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Facebook, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61573796805868';

declare global {
  interface Window {
    FB: {
      XFBML: {
        parse: (element?: HTMLElement) => void;
      };
    };
    fbAsyncInit: () => void;
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut' as const,
    },
  },
};

const FacebookFeed = () => {
  useEffect(() => {
    // Initialize Facebook SDK
    window.fbAsyncInit = function () {
      window.FB.XFBML.parse();
    };

    // Load the SDK asynchronously
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_GB/sdk.js#xfbml=1&version=v18.0';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    } else if (window.FB) {
      // If SDK already loaded, re-parse
      window.FB.XFBML.parse();
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <motion.section
      className="py-24 bg-card"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
            Follow Our Journey
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold">Lumina Life</h2>
        </motion.div>

        {/* Facebook Page Plugin */}
        <motion.div 
          variants={itemVariants} 
          className="flex justify-center"
        >
          <div className="rounded-xl overflow-hidden shadow-2xl bg-white">
            <div
              className="fb-page"
              data-href={FACEBOOK_PAGE_URL}
              data-tabs="timeline"
              data-width="500"
              data-height="600"
              data-small-header="false"
              data-adapt-container-width="true"
              data-hide-cover="false"
              data-show-facepile="true"
            >
              <blockquote
                cite={FACEBOOK_PAGE_URL}
                className="fb-xfbml-parse-ignore"
              >
                <a href={FACEBOOK_PAGE_URL}>Lumina Auto</a>
              </blockquote>
            </div>
          </div>
        </motion.div>

        {/* Fallback CTA */}
        <motion.div variants={itemVariants} className="text-center mt-10">
          <p className="text-muted-foreground text-sm mb-4">
            Can't see the feed? Visit us directly on Facebook.
          </p>
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="group">
              <Facebook className="w-5 h-5 mr-2" />
              View on Facebook
              <ExternalLink className="w-4 h-4 ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Button>
          </a>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default FacebookFeed;
