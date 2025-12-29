import { useEffect, useState, useCallback } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

const CustomCursor = () => {
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  const springConfig = { damping: 25, stiffness: 400 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  const moveCursor = useCallback((e: MouseEvent) => {
    cursorX.set(e.clientX);
    cursorY.set(e.clientY);
  }, [cursorX, cursorY]);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('mousemove', moveCursor);

    // Add hover detection
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('[data-cursor-hover]') ||
        target.classList.contains('vehicle-card')
      ) {
        setIsHovering(true);
      }
    };

    const handleMouseOut = () => {
      setIsHovering(false);
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', moveCursor);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [moveCursor]);

  if (isMobile) return null;

  return (
    <>
      {/* Cursor Dot */}
      <motion.div
        className="cursor-dot"
        style={{
          left: cursorXSpring,
          top: cursorYSpring,
          width: isHovering ? 12 : 8,
          height: isHovering ? 12 : 8,
          backgroundColor: isHovering ? 'hsl(43 74% 49%)' : 'hsl(0 0% 98%)',
        }}
      />
      
      {/* Cursor Ring */}
      <motion.div
        className={`cursor-ring ${isHovering ? 'expanded' : ''}`}
        style={{
          left: cursorXSpring,
          top: cursorYSpring,
        }}
      />
    </>
  );
};

export default CustomCursor;
