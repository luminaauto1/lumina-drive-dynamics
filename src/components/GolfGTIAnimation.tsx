import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const GolfGTIAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Car drives from left to right as user scrolls
  const carX = useTransform(scrollYProgress, [0, 1], ['-100%', '150%']);
  const wheelRotation = useTransform(scrollYProgress, [0, 1], [0, 1440]); // 4 full rotations
  
  // Speed lines opacity
  const speedLinesOpacity = useTransform(scrollYProgress, [0.2, 0.4, 0.6, 0.8], [0, 0.7, 0.7, 0]);

  return (
    <div ref={containerRef} className="relative h-[50vh] overflow-hidden bg-background">
      {/* Road */}
      <div className="absolute bottom-1/3 left-0 right-0">
        <div className="h-px bg-border" />
        <div className="flex gap-8 justify-start mt-2 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div 
              key={i} 
              className="w-12 h-0.5 bg-muted-foreground/30 flex-shrink-0"
              style={{
                x: useTransform(scrollYProgress, [0, 1], [0, -200])
              }}
            />
          ))}
        </div>
      </div>

      {/* Speed Lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: speedLinesOpacity }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            style={{
              left: '5%',
              right: '40%',
              top: `${38 + i * 3}%`,
            }}
          />
        ))}
      </motion.div>

      {/* Golf GTI */}
      <motion.div
        className="absolute bottom-1/3 translate-y-1/2"
        style={{ x: carX }}
      >
        <div className="relative">
          {/* Car Shadow */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-64 h-4 bg-black/30 blur-xl rounded-full" />
          
          {/* Car Body - Using a stylized Golf GTI representation */}
          <div className="relative w-64 h-32">
            {/* Main Body */}
            <div className="absolute bottom-8 left-0 right-0 h-16 bg-gradient-to-b from-foreground/90 to-foreground/70 rounded-lg">
              {/* Windows */}
              <div className="absolute top-1 left-8 right-8 h-8 bg-primary/20 rounded-t-lg border border-primary/30" />
              
              {/* Front Grille */}
              <div className="absolute bottom-2 left-2 w-6 h-8 bg-background/20 rounded-sm" />
              
              {/* Headlights */}
              <div className="absolute bottom-4 left-0 w-3 h-2 bg-primary rounded-r-full shadow-[0_0_10px_hsl(var(--primary))]" />
              
              {/* Taillights */}
              <div className="absolute bottom-4 right-0 w-3 h-2 bg-destructive rounded-l-full shadow-[0_0_10px_hsl(var(--destructive))]" />
              
              {/* GTI Badge */}
              <div className="absolute bottom-10 right-10 text-xs font-bold text-primary">GTI</div>
            </div>
            
            {/* Front Wheel */}
            <motion.div
              className="absolute bottom-4 left-10 w-10 h-10"
              style={{ rotate: wheelRotation }}
            >
              <div className="w-full h-full rounded-full border-4 border-muted-foreground bg-background flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/50 bg-background">
                  <div className="w-full h-full relative">
                    {[0, 72, 144, 216, 288].map((deg) => (
                      <div
                        key={deg}
                        className="absolute w-0.5 h-2 bg-muted-foreground/70 left-1/2 -translate-x-1/2"
                        style={{ transform: `translateX(-50%) rotate(${deg}deg)`, transformOrigin: 'center 12px' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Rear Wheel */}
            <motion.div
              className="absolute bottom-4 right-10 w-10 h-10"
              style={{ rotate: wheelRotation }}
            >
              <div className="w-full h-full rounded-full border-4 border-muted-foreground bg-background flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/50 bg-background">
                  <div className="w-full h-full relative">
                    {[0, 72, 144, 216, 288].map((deg) => (
                      <div
                        key={deg}
                        className="absolute w-0.5 h-2 bg-muted-foreground/70 left-1/2 -translate-x-1/2"
                        style={{ transform: `translateX(-50%) rotate(${deg}deg)`, transformOrigin: 'center 12px' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Text */}
      <motion.div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center"
        style={{ 
          opacity: useTransform(scrollYProgress, [0.3, 0.5, 0.7], [0, 1, 0])
        }}
      >
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          The New Era of Vehicle Sourcing
        </p>
      </motion.div>
    </div>
  );
};

export default GolfGTIAnimation;
