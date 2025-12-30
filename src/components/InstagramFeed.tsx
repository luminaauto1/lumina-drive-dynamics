import { motion } from 'framer-motion';
import { Instagram } from 'lucide-react';

const INSTAGRAM_URL = 'https://www.instagram.com/lumina.auto/';

const placeholderImages = [
  '/lovable-uploads/16189aee-0fe1-4c9b-9a90-bcb743ad9a1d.png',
  '/lovable-uploads/25556c01-2cd0-479c-900d-7b4e95fc833c.png',
  '/lovable-uploads/2c1e61bb-b03a-4471-acb6-6c97cfdfcb54.png',
  '/lovable-uploads/62a02875-dd4d-4e20-b4ca-4effc97d7e4b.png',
];

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

const InstagramFeed = () => {
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
            Follow the Journey
          </span>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Instagram className="w-5 h-5" />
            <span className="text-lg">@lumina.auto</span>
          </a>
        </motion.div>

        {/* Image Grid */}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {placeholderImages.map((image, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
              >
                <img
                  src={image}
                  alt={`Lumina Auto Instagram post ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2">
                  <Instagram className="w-8 h-8 text-white" />
                  <span className="text-white text-sm font-medium">View Post</span>
                </div>
              </motion.div>
            ))}
          </div>
        </a>
      </div>
    </motion.section>
  );
};

export default InstagramFeed;
