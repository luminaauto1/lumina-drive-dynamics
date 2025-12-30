import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
const GolfGTIAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    scrollYProgress
  } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  // Car drives from left to right as user scrolls
  const carX = useTransform(scrollYProgress, [0, 1], ['-100%', '150%']);

  // Speed lines opacity
  const speedLinesOpacity = useTransform(scrollYProgress, [0.2, 0.4, 0.6, 0.8], [0, 0.7, 0.7, 0]);
  return <div ref={containerRef} className="relative h-[50vh] overflow-hidden bg-background">
      {/* Road */}
      <div className="absolute bottom-1/3 left-0 right-0">
        <div className="h-px bg-border" />
        <div className="flex gap-8 justify-start mt-2 overflow-hidden">
          {Array.from({
          length: 30
        }).map((_, i) => <motion.div key={i} className="w-12 h-0.5 bg-muted-foreground/30 flex-shrink-0" style={{
          x: useTransform(scrollYProgress, [0, 1], [0, -200])
        }} />)}
        </div>
      </div>

      {/* Speed Lines */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{
      opacity: speedLinesOpacity
    }}>
        {Array.from({
        length: 6
      }).map((_, i) => <motion.div key={i} className="absolute h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" style={{
        left: '5%',
        right: '40%',
        top: `${38 + i * 3}%`
      }} />)}
      </motion.div>

      {/* Golf GTI Image */}
      <motion.div className="absolute bottom-1/3 translate-y-1/2" style={{
      x: carX
    }}>
        <div className="relative">
          {/* Car Shadow */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-64 h-4 bg-black/30 blur-xl rounded-full" />
          
          {/* GTI Image */}
          <img alt="Volkswagen Golf GTI" className="w-64 h-auto object-contain" style={{
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
        }} src="/lovable-uploads/2c1e61bb-b03a-4471-acb6-6c97cfdfcb54.png" />
        </div>
      </motion.div>

      {/* Text */}
      <motion.div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center" style={{
      opacity: useTransform(scrollYProgress, [0.3, 0.5, 0.7], [0, 1, 0])
    }}>
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          The New Era of Vehicle Sourcing
        </p>
      </motion.div>
    </div>;
};
export default GolfGTIAnimation;