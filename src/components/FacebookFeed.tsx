import { motion } from 'framer-motion';
import { Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61573796805868';
const IFRAME_SRC = 'https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fprofile.php%3Fid%3D61573796805868&tabs=timeline&width=500&height=600&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
};

const FacebookFeed = () => {
  return (
    <motion.section
      className="py-20 bg-background"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
            Join the Community
          </span>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Facebook className="w-5 h-5" />
            <span className="text-lg">Lumina Auto</span>
          </a>
        </motion.div>

        {/* Facebook Feed Iframe */}
        <motion.div 
          variants={itemVariants}
          className="flex justify-center"
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            <iframe
              src={IFRAME_SRC}
              width="500"
              height="600"
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              title="Lumina Auto Facebook Page"
            />
          </div>
        </motion.div>

        {/* Fallback Button */}
        <motion.div variants={itemVariants} className="text-center mt-8">
          <Button variant="outline" asChild>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <Facebook className="w-4 h-4" />
              View on Facebook
            </a>
          </Button>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default FacebookFeed;
