import { useRef, useEffect } from 'react';

const FRAME_COUNT = 100;
const FRAME_PATH = '/scroll-frames';
const FRAME_PREFIX = 'Lumina Auto Video_';
const FRAME_EXT = 'jpg';

const getFrameSrc = (index: number) => {
  const n = String(index + 1).padStart(3, '0');
  return `${FRAME_PATH}/${encodeURIComponent(`${FRAME_PREFIX}${n}.${FRAME_EXT}`)}`;
};

const GolfGTIAnimation = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const targetFrameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preload all frames
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = getFrameSrc(i);
      images.push(img);
    }
    imagesRef.current = images;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = (index: number) => {
      const img = imagesRef.current[index];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);
      // object-cover behavior
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr) {
        dh = ch;
        dw = ch * ir;
        dx = (cw - dw) / 2;
        dy = 0;
      } else {
        dw = cw;
        dh = cw / ir;
        dx = 0;
        dy = (ch - dh) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    };

    // Draw first frame as soon as it loads
    if (images[0]) {
      if (images[0].complete) drawFrame(0);
      else images[0].addEventListener('load', () => drawFrame(currentFrameRef.current), { once: true });
    }

    const computeTarget = () => {
      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / Math.max(1, total)));
      targetFrameRef.current = Math.round(progress * (FRAME_COUNT - 1));
    };

    const tick = () => {
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      if (target !== current) {
        // Lerp toward target for smoothness
        const next = current + (target - current) * 0.18;
        const nextIdx = target > current ? Math.ceil(next) : Math.floor(next);
        currentFrameRef.current = nextIdx;
        drawFrame(nextIdx);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
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

    const onResize = () => {
      resizeCanvas();
      computeTarget();
      drawFrame(currentFrameRef.current);
    };

    resizeCanvas();
    computeTarget();
    currentFrameRef.current = targetFrameRef.current;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
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

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      stopLoop();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative bg-background w-screen left-1/2 -translate-x-1/2 h-[56.25vw] md:h-[300vh]"
    >
      <div className="relative md:sticky md:top-0 w-full aspect-video md:h-screen md:aspect-auto overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full block bg-background"
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
