import { useRef, useEffect } from 'react';
import videoAsset from '@/assets/lumina-auto.mp4.asset.json';

const GolfGTIAnimation = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    const wrapper = wrapperRef.current;
    if (!video || !wrapper) return;

    const FRICTION = 0.08;
    const EPSILON = 0.001;

    const computeTarget = () => {
      const duration = video.duration;
      if (!duration || isNaN(duration)) return;
      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const progress = Math.min(
        1,
        Math.max(0, (vh - rect.top) / Math.max(1, total))
      );
      targetTimeRef.current = progress * duration;
    };

    const tick = () => {
      const diff = targetTimeRef.current - currentTimeRef.current;
      if (Math.abs(diff) > EPSILON) {
        currentTimeRef.current += diff * FRICTION;
        try {
          video.currentTime = currentTimeRef.current;
        } catch {}
      } else {
        currentTimeRef.current = targetTimeRef.current;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const onScroll = () => {
      if (!isVisibleRef.current) return;
      computeTarget();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            if (video.preload !== 'auto') video.preload = 'auto';
            computeTarget();
            startLoop();
          } else {
            stopLoop();
          }
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(wrapper);

    const onReady = () => {
      computeTarget();
      currentTimeRef.current = targetTimeRef.current;
    };
    if (video.readyState >= 1) onReady();
    else video.addEventListener('loadedmetadata', onReady);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      video.removeEventListener('loadedmetadata', onReady);
      stopLoop();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative bg-background w-screen left-1/2 -translate-x-1/2 h-[56.25vw] md:h-[140vh]"
    >
      <div
        ref={stickyRef}
        className="relative md:sticky md:top-0 w-full aspect-video md:h-screen md:aspect-auto overflow-hidden"
      >
        <video
          ref={videoRef}
          src={videoAsset.url}
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          className="w-full h-full object-contain md:object-cover bg-background"
          style={{
            transform: 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/70 pointer-events-none" />
        <div className="absolute top-4 md:top-[10%] left-1/2 -translate-x-1/2 text-center px-6 w-full">
          <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-muted-foreground">
            The New Era of Vehicle Sourcing
          </p>
        </div>
      </div>
    </div>
  );
};

export default GolfGTIAnimation;
