import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const ParallaxCar = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Car moves from left (-100%) to right (100vw) based on scroll
  const carX = useTransform(scrollYProgress, [0, 1], ['-100%', '100vw']);
  const carOpacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

  return (
    <div ref={containerRef} className="relative h-[50vh] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-background to-charcoal" />
      
      {/* Road Line */}
      <div className="absolute bottom-1/3 left-0 right-0 h-px bg-border" />
      
      {/* Moving Car */}
      <motion.div
        style={{ x: carX, opacity: carOpacity }}
        className="absolute bottom-1/3 transform -translate-y-1/2"
      >
        <img
          src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80"
          alt="Luxury Car"
          className="h-32 md:h-48 object-contain drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))' }}
        />
      </motion.div>

      {/* Dust Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-muted-foreground/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${50 + Math.random() * 30}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              x: [0, Math.random() * 50 - 25],
              y: [0, Math.random() * -20],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ParallaxCar;
