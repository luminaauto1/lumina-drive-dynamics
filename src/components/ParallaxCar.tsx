import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const ParallaxCar = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Phase 1: Assembly (0-50% scroll)
  // Chassis fades in at 0%
  const chassisOpacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
  const chassisScale = useTransform(scrollYProgress, [0, 0.15], [0.8, 1]);
  
  // Body flies in from top at 20%
  const bodyY = useTransform(scrollYProgress, [0.15, 0.3], [-80, 0]);
  const bodyOpacity = useTransform(scrollYProgress, [0.15, 0.25], [0, 1]);
  
  // Wheels roll in from sides at 30%
  const leftWheelX = useTransform(scrollYProgress, [0.25, 0.4], [-150, 0]);
  const rightWheelX = useTransform(scrollYProgress, [0.25, 0.4], [150, 0]);
  const wheelsOpacity = useTransform(scrollYProgress, [0.25, 0.35], [0, 1]);
  const wheelRotation = useTransform(scrollYProgress, [0.25, 0.4], [-360, 0]);
  
  // Phase 2: Headlight bloom (50-60% scroll)
  const headlightGlow = useTransform(scrollYProgress, [0.45, 0.55], [0, 1]);
  
  // Phase 3: Acceleration (60-100% scroll)
  const carX = useTransform(scrollYProgress, [0.55, 1], ['0%', '150%']);
  const carOpacity = useTransform(scrollYProgress, [0.55, 0.6, 0.9, 1], [1, 1, 1, 0]);

  return (
    <div ref={containerRef} className="relative h-[80vh] overflow-hidden bg-background">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(0 0% 100% / 0.03) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(0 0% 100% / 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Ambient Glow */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: headlightGlow }}
      >
        <div className="w-[600px] h-[300px] bg-gradient-radial from-white/20 via-white/5 to-transparent blur-3xl" />
      </motion.div>

      {/* Road Line */}
      <div className="absolute bottom-1/3 left-0 right-0 h-px bg-white/10" />
      <div className="absolute bottom-1/3 left-0 right-0">
        <div className="flex gap-8 justify-center">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-12 h-0.5 bg-white/20" />
          ))}
        </div>
      </div>

      {/* Main Car Assembly Container */}
      <motion.div
        className="absolute left-1/2 bottom-1/3 -translate-x-1/2 translate-y-1/2"
        style={{ x: carX, opacity: carOpacity }}
      >
        {/* Layer 1: Chassis/Frame */}
        <motion.div
          className="relative"
          style={{ opacity: chassisOpacity, scale: chassisScale }}
        >
          {/* Simplified chassis representation - shadow/base */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-72 h-4 bg-black/50 blur-xl rounded-full" />
          
          {/* Layer 2: Body Work */}
          <motion.div
            style={{ y: bodyY, opacity: bodyOpacity }}
            className="relative z-10"
          >
            <img
              src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80"
              alt="Luxury Car Body"
              className="h-40 md:h-56 object-contain drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }}
            />
            
            {/* Headlight Bloom Effect */}
            <motion.div
              className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-4"
              style={{ opacity: headlightGlow }}
            >
              <div className="w-full h-full bg-white rounded-full headlight-bloom" />
            </motion.div>
            <motion.div
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-4"
              style={{ opacity: headlightGlow }}
            >
              <div className="w-full h-full bg-white rounded-full headlight-bloom" />
            </motion.div>
          </motion.div>

          {/* Layer 3: Wheels */}
          <motion.div
            className="absolute -bottom-2 left-8 w-16 h-16 md:w-20 md:h-20"
            style={{ x: leftWheelX, opacity: wheelsOpacity, rotate: wheelRotation }}
          >
            <div className="w-full h-full rounded-full border-4 border-white/30 bg-charcoal flex items-center justify-center">
              <div className="w-3/4 h-3/4 rounded-full border-2 border-white/20 bg-charcoal-light" />
            </div>
          </motion.div>
          
          <motion.div
            className="absolute -bottom-2 right-8 w-16 h-16 md:w-20 md:h-20"
            style={{ x: rightWheelX, opacity: wheelsOpacity, rotate: wheelRotation }}
          >
            <div className="w-full h-full rounded-full border-4 border-white/30 bg-charcoal flex items-center justify-center">
              <div className="w-3/4 h-3/4 rounded-full border-2 border-white/20 bg-charcoal-light" />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Assembly Text Indicators */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center">
        <motion.p 
          className="text-sm uppercase tracking-[0.3em] text-muted-foreground"
          style={{ opacity: useTransform(scrollYProgress, [0, 0.1, 0.5, 0.55], [0, 1, 1, 0]) }}
        >
          Precision Engineering
        </motion.p>
        <motion.p 
          className="text-sm uppercase tracking-[0.3em] text-primary mt-2"
          style={{ opacity: useTransform(scrollYProgress, [0.5, 0.55, 0.6], [0, 1, 0]) }}
        >
          Ignition
        </motion.p>
      </div>

      {/* Speed Lines (appear during acceleration) */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ opacity: useTransform(scrollYProgress, [0.6, 0.7, 0.95, 1], [0, 0.6, 0.6, 0]) }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              left: '10%',
              right: '60%',
              top: `${35 + i * 4}%`,
            }}
          />
        ))}
      </motion.div>

      {/* Particle Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${40 + Math.random() * 30}%`,
            }}
            animate={{
              opacity: [0, 0.8, 0],
              x: [0, Math.random() * 30 - 15],
              y: [0, Math.random() * -20],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ParallaxCar;