import { motion } from 'framer-motion';
import { Facebook } from 'lucide-react';

const MOCK_POSTS = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&h=400&fit=crop',
    caption: 'Another happy client joining the Lumina family! Congrats on your new M4.',
    date: '2 days ago',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=600&h=400&fit=crop',
    caption: 'Just Landed: 2023 GT3 RS. This won\'t last long.',
    date: '5 days ago',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&h=400&fit=crop',
    caption: 'Quality checks in progress. We don\'t compromise.',
    date: '1 week ago',
  },
];

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61573796805868';

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
  return (
    <motion.section
      className="py-24"
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

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MOCK_POSTS.map((post) => (
            <motion.a
              key={post.id}
              href={FACEBOOK_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              variants={itemVariants}
              className="group block"
            >
              <div className="glass-card rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300">
                {/* Image */}
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.caption}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Content */}
                <div className="p-5 bg-card/80 backdrop-blur-sm">
                  <p className="text-foreground text-sm leading-relaxed mb-3 line-clamp-2">
                    {post.caption}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{post.date}</span>
                    <Facebook className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Follow CTA */}
        <motion.div variants={itemVariants} className="text-center mt-10">
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <Facebook className="w-5 h-5" />
            Follow us on Facebook
          </a>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default FacebookFeed;
