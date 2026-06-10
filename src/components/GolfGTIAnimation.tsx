import { useRef, useEffect } from 'react';

const FRAME_COUNT = 100;
const FRAME_PATH = '/scroll-frames';
const FRAME_PREFIX = 'lumina-auto-video-';
const FRAME_EXT = 'jpg';

const getFrameSrc = (index: number) => {
  const n = String(index).padStart(3, '0');
  return `${FRAME_PATH}/${FRAME_PREFIX}${n}.${FRAME_EXT}`;
};

const GolfGTIAnimation = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = (index: number) => {
      const images = imagesRef.current;
      // Find nearest loaded frame (prefer exact, fall back to closest loaded)
      let img = images[index];
      if (!img || !img.complete || img.naturalWidth === 0) {
        for (let r = 1; r < FRAME_COUNT; r++) {
          const a = images[index - r];
          if (a && a.complete && a.naturalWidth > 0) { img = a; break; }
          const b = images[index + r];
          if (b && b.complete && b.naturalWidth > 0) { img = b; break; }
        }
      }
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr) {
        dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0;
      } else {
        dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
      drawnFrameRef.current = index;
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Preload all frames; redraw when target frame finishes loading
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = () => {
        // If this load matches (or is near) the target, refresh the canvas
        if (Math.abs(i - targetFrameRef.current) <= 2 || drawnFrameRef.current === -1) {
          drawFrame(targetFrameRef.current);
        }
      };
      img.src = getFrameSrc(i);
      images.push(img);
    }
    imagesRef.current = images;

    const computeTarget = () => {
      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when section's top edge enters the viewport bottom; 1 when its bottom edge leaves the viewport top
      const scrubRange = Math.max(1, vh + rect.height);
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / scrubRange));
      targetFrameRef.current = Math.round(progress * (FRAME_COUNT - 1));
    };

    const scheduleDraw = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        drawFrame(targetFrameRef.current);
      });
    };

    const onScroll = () => {
      computeTarget();
      scheduleDraw();
    };

    const onResize = () => {
      resizeCanvas();
      computeTarget();
      drawFrame(targetFrameRef.current);
    };

    resizeCanvas();
    computeTarget();
    drawFrame(targetFrameRef.current);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative bg-background w-screen left-1/2 -translate-x-1/2 aspect-video md:h-screen md:aspect-auto overflow-hidden"
    >
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
  );
};

export default GolfGTIAnimation;
