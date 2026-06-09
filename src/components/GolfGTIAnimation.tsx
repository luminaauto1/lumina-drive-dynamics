import { useRef, useEffect } from 'react';
import videoAsset from '@/assets/lumina-auto.mp4.asset.json';

const GolfGTIAnimation = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const wrapper = wrapperRef.current;
    const sticky = stickyRef.current;
    if (!video || !wrapper || !sticky) return;

    const update = () => {
      rafRef.current = null;
      const duration = video.duration;
      if (!duration || isNaN(duration)) return;

      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const progress = Math.min(
        1,
        Math.max(0, (vh - rect.top) / Math.max(1, total))
      );
      video.currentTime = progress * duration;
    };

    const onScroll = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    const onReady = () => update();
    if (video.readyState >= 1) onReady();
    else video.addEventListener('loadedmetadata', onReady);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      video.removeEventListener('loadedmetadata', onReady);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative h-[70vh] bg-background w-screen left-1/2 -translate-x-1/2">
      <div
        ref={stickyRef}
        className="sticky top-16 md:top-0 h-[50vh] sm:h-[60vh] md:h-screen w-full overflow-hidden"
      >
        <video
          ref={videoRef}
          src={videoAsset.url}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="w-full h-full object-contain md:object-cover bg-background"
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
