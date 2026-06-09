import { useRef, useEffect } from 'react';
import videoAsset from '@/assets/lumina-auto.mp4.asset.json';

const GolfGTIAnimation = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const wrapper = wrapperRef.current;
    if (!video || !wrapper) return;

    const update = () => {
      rafRef.current = null;
      const duration = video.duration;
      if (!duration || isNaN(duration)) return;

      const rect = wrapper.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = Math.min(
        1,
        Math.max(0, -rect.top / Math.max(1, scrollable))
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
    <div ref={wrapperRef} className="relative min-h-[300vh] bg-background">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <video
          ref={videoRef}
          src={videoAsset.url}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80 pointer-events-none" />
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 text-center px-6">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            The New Era of Vehicle Sourcing
          </p>
        </div>
      </div>
    </div>
  );
};

export default GolfGTIAnimation;
