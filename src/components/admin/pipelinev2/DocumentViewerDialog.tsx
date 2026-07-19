import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Maximize2, RefreshCw,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Full-page paginated viewer for stored client documents (credit-check reports
 * today; written generically so ClientCockpit can adopt it later).
 *
 * PDFs render ONE FULL PAGE AT A TIME to a canvas via pdf.js at fit-to-width
 * scale — no cut-off h-64 iframe, no inner scrollbar chrome — with Prev/Next
 * paging and a "Page N / M" readout. Images open at full size in the same
 * dialog shell.
 *
 * pdf.js is heavy, so it is lazy-imported (worker wired with the proven `?url`
 * recipe from src/lib/pdfCompression.ts) and only when a PDF is actually shown.
 */

type RenderState = 'rendering' | 'done' | 'error';

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  // Vite-friendly worker wiring: `?url` gives the hashed asset URL the bundler
  // emits, so the worker resolves in dev and in the production build.
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default;
  return pdfjs;
}

/** Fetches + parses the PDF behind a (signed) URL while `enabled`. The document
 *  is destroyed (and any in-flight fetch aborted) on unmount or URL change;
 *  `retry` re-attempts the SAME url after a failure (network blip, corrupt
 *  file). An EXPIRED signed URL can only be cured by minting a fresh one, so
 *  viewer Retry buttons also call the owner's `onRetry` (CreditCheckAttachment
 *  re-signs, the url prop changes, and this hook reloads). */
function usePdfDocument(url: string | null | undefined, enabled: boolean) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setError(false);
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !url) return;
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    const aborter = new AbortController();
    setDoc(null);
    setError(false);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        // Fetch ourselves (the Download button already does) instead of handing
        // the signed URL to pdf.js — one code path, predictable CORS behaviour.
        const res = await fetch(url, { signal: aborter.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        loaded = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          loaded.destroy();
          return;
        }
        setDoc(loaded);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      aborter.abort();
      loaded?.destroy();
      setDoc(null);
    };
  }, [url, enabled, attempt]);

  return { doc, error, retry };
}

/** One PDF page → canvas, devicePixelRatio-aware (the canvas backing store is
 *  scaled by dpr, then squeezed back to CSS pixels) so text stays sharp on
 *  hiDPI screens. Two fit modes, both driven by the SAME measured width:
 *
 *  - default (dialog): fit-to-WIDTH — the page fills the measured container.
 *  - `fitHeight` (compact preview): fit-to-HEIGHT capped by fit-to-width, i.e.
 *    `scale = min(fitHeight / pageHeight, availWidth / pageWidth)`. The height
 *    target makes the page big and fully visible; the width term is the safety
 *    net so a narrow drawer/phone can never be overflowed. The whole page is
 *    always visible in both dimensions — nothing is ever clipped.
 *
 *  The container is measured before first paint and tracked with a
 *  ResizeObserver (the canvas carries fixed px, so a width change must
 *  re-render). `frameClassName` styles a snug `w-fit` box drawn around the
 *  canvas; its padding/border is subtracted from the measured width so the
 *  frame hugs the page instead of the page overflowing the frame.
 *
 *  Cancels any in-flight render when the page or document changes. */
function PdfPageCanvas({
  doc, pageNum, onRenderState, canvasClassName, frameClassName, fitHeight,
}: {
  doc: PDFDocumentProxy;
  pageNum: number;
  onRenderState?: (s: RenderState) => void;
  canvasClassName?: string;
  /** Classes for the shrink-to-fit frame drawn around the canvas. */
  frameClassName?: string;
  /** CSS px height to fit the whole page into (switches to fit-to-height mode). */
  fitHeight?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Width available to the CANVAS: the (full-width) wrapper minus the frame's
  // own padding + border. Measured before first paint then tracked via
  // ResizeObserver. The >1px guard swallows scrollbar/rounding jitter so a
  // settled layout can't re-render in a loop. The wrapper is always w-full and
  // the frame is w-fit, so measuring can never feed back into the layout.
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () =>
      setWidth((prev) => {
        const frame = frameRef.current;
        const cs = frame ? getComputedStyle(frame) : null;
        const inset = cs
          ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
            (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
          : 0;
        const w = Math.max(0, Math.floor(wrap.clientWidth - inset));
        return Math.abs(prev - w) > 1 ? w : prev;
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return; // container not laid out yet
    let cancelled = false;
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | null = null;
    onRenderState?.('rendering');
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        // CSS-pixel scale: fit-to-width, and in preview mode the smaller of that
        // and fit-to-height — so the page fits BOTH dimensions.
        const fitToWidth = Math.max(1, width) / base.width;
        const cssScale = fitHeight
          ? Math.min(Math.max(1, fitHeight) / base.height, fitToWidth)
          : fitToWidth;
        // Backing store is dpr-scaled, then squeezed back to CSS px below.
        const viewport = page.getViewport({ scale: cssScale * dpr });
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${Math.max(1, Math.floor(viewport.width / dpr))}px`;
        canvas.style.height = `${Math.max(1, Math.floor(viewport.height / dpr))}px`;
        // White matte so transparent regions read as paper (as pdfCompression does).
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
        if (!cancelled) onRenderState?.('done');
      } catch (e) {
        // A cancelled render (page flipped mid-render) is not an error.
        if (!cancelled && (e as Error)?.name !== 'RenderingCancelledException') {
          onRenderState?.('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNum, width, fitHeight, onRenderState]);

  return (
    <div ref={wrapRef} className="flex w-full justify-center">
      <div ref={frameRef} className={cn('w-fit max-w-full', frameClassName)}>
        <canvas ref={canvasRef} className={cn('block bg-white', canvasClassName)} />
      </div>
    </div>
  );
}

/** Target CSS height of the compact preview page — big enough to read at a
 *  glance. The rendered page is capped to the available width too (see
 *  PdfPageCanvas), so it never overflows a narrow drawer. */
const PREVIEW_PAGE_HEIGHT = 560;
/** Portrait-A4 width at PREVIEW_PAGE_HEIGHT — used only to shape the loading
 *  placeholder so the frame doesn't jump when the real page lands. */
const PREVIEW_PLACEHOLDER_WIDTH = 396;

/** Compact drawer preview: the ENTIRE first PDF page rendered large (~560px
 *  tall, capped to the available width) so it can be read at a glance without
 *  any inner scrolling/clipping. The tinted frame SHRINKS TO THE PAGE rather
 *  than spanning the profile column, so there's no dead space either side.
 *  Click opens the full paginated viewer. */
export function PdfFirstPagePreview({
  url, onExpand, onRetry,
}: {
  url: string | null;
  onExpand: () => void;
  /** Also invoked by Retry — owners re-mint the signed URL here (an expired
   *  signature can't be cured by refetching the same URL). */
  onRetry?: () => void;
}) {
  const { doc, error, retry } = usePdfDocument(url, !!url);
  const [state, setState] = useState<RenderState>('rendering');
  const onRenderState = useCallback((s: RenderState) => setState(s), []);

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <span>Couldn't load the PDF preview.</span>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { retry(); onRetry?.(); }}>
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      title="Open the full paginated viewer"
      className="group relative block w-full cursor-zoom-in text-left"
    >
      {doc ? (
        <PdfPageCanvas
          doc={doc}
          pageNum={1}
          fitHeight={PREVIEW_PAGE_HEIGHT}
          onRenderState={onRenderState}
          frameClassName="overflow-hidden rounded-md border border-border bg-muted/30 p-1.5 shadow-sm"
          canvasClassName="rounded-sm"
        />
      ) : (
        <div
          className="mx-auto flex max-w-full items-center justify-center rounded-md border border-border bg-muted/30"
          style={{ height: PREVIEW_PAGE_HEIGHT, width: PREVIEW_PLACEHOLDER_WIDTH }}
        >
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {doc && state === 'error' && (
        <div className="p-3 pt-0 text-sm text-muted-foreground">Couldn't render the preview.</div>
      )}
      {/* Expand hint — the whole page is visible, so no clipping fade needed. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center">
        <span className="flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          <Maximize2 className="w-3 h-3" /> View full document
        </span>
      </div>
    </button>
  );
}

export function DocumentViewerDialog({
  open, onOpenChange, url, kind, filename, onDownload, onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  kind: 'pdf' | 'image';
  filename: string;
  onDownload?: () => void;
  /** Also invoked by Retry — owners re-mint the signed URL here (an expired
   *  signature can't be cured by refetching the same URL). */
  onRetry?: () => void;
}) {
  const isPdf = kind === 'pdf';
  // Only load (and keep) the document while the dialog is actually open.
  const { doc, error, retry } = usePdfDocument(url, open && isPdf);
  const [pageNum, setPageNum] = useState(1);
  const [pageState, setPageState] = useState<RenderState>('rendering');
  const numPages = doc?.numPages ?? 0;
  const onRenderState = useCallback((s: RenderState) => setPageState(s), []);

  // A fresh document (or a reopen) always starts at page 1.
  useEffect(() => {
    if (open) setPageNum(1);
  }, [open, doc]);

  const prev = () => setPageNum((p) => Math.max(1, p - 1));
  const next = () => setPageNum((p) => Math.min(Math.max(numPages, 1), p + 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-w-4xl flex-col gap-0 overflow-hidden p-0"
        onKeyDown={(e) => {
          if (!isPdf || !doc) return;
          if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
          if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        }}
      >
        {/* Toolbar: filename + pager + actions. pr-12 clears the shadcn close X. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 pr-12">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold" title={filename}>
            {filename}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            {isPdf && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm" variant="outline" className="h-8 w-8 p-0"
                  onClick={prev} disabled={!doc || pageNum <= 1} aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-[76px] text-center text-xs tabular-nums text-muted-foreground">
                  {doc ? `Page ${pageNum} / ${numPages}` : 'Page – / –'}
                </span>
                <Button
                  size="sm" variant="outline" className="h-8 w-8 p-0"
                  onClick={next} disabled={!doc || pageNum >= numPages} aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
            {onDownload && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onDownload}>
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
            )}
            {url && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => window.open(url, '_blank')}>
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </Button>
            )}
          </div>
        </div>

        {/* Page surface: the ONE full page at fit-to-width; taller-than-dialog
            pages scroll vertically here while the toolbar stays put. */}
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4">
          {isPdf ? (
            error ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                Couldn't load this PDF.
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { retry(); onRetry?.(); }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            ) : !doc ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <PdfPageCanvas
                  doc={doc}
                  pageNum={pageNum}
                  onRenderState={onRenderState}
                  canvasClassName="rounded border border-border shadow-sm"
                />
                {pageState === 'rendering' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {pageState === 'error' && (
                  <div className="mt-3 text-center text-sm text-muted-foreground">
                    Couldn't render this page.
                  </div>
                )}
              </>
            )
          ) : url ? (
            <img src={url} alt={filename} className="mx-auto h-auto max-w-full rounded" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
