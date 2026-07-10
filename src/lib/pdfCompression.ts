/**
 * Browser-side PDF compression for archival uploads.
 *
 * Credit-check reports are saved to Storage and then rarely opened again — they
 * are only pulled up later when someone searches a client's previous report. So
 * moderate visual quality is an easy trade for a much smaller file. This flattens
 * each page to a downscaled JPEG (longest edge ~1600px, quality 0.6) and rebuilds
 * a fresh PDF from those rasters, typically cutting size dramatically for the
 * screenshot-heavy / scanned PDFs staff paste in.
 *
 * Best-effort and defensive, mirroring imageCompression.ts: the ENTIRE body is
 * wrapped in try/catch and ANY failure (or a non-PDF input, or a rebuild that
 * wouldn't actually shrink the file) returns the ORIGINAL File untouched. This
 * must never throw and never break the upload.
 *
 * Heavy deps (pdfjs-dist, jspdf) are lazy-imported inside the function so they
 * stay out of the main bundle and only load when a PDF is actually compressed.
 */

/** Longest page edge, in pixels, of the rasterised output. */
const MAX_EDGE = 1600;
/** JPEG quality for the flattened page images (0-1). */
const JPEG_QUALITY = 0.6;

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Compress a PDF File by rasterising each page. Returns a new (smaller) `.pdf`
 * File on success, or the ORIGINAL File unchanged for non-PDFs, on any error, or
 * when the rebuilt PDF would not be smaller than the original.
 */
export async function compressPdf(file: File): Promise<File> {
  try {
    if (!isPdfFile(file)) return file;

    // Lazy-load heavy deps so they never enter the main bundle.
    const pdfjs = await import('pdfjs-dist');
    const { jsPDF } = await import('jspdf');

    // Vite-friendly worker wiring: `?url` gives the hashed asset URL the bundler
    // emits, so the worker resolves in dev and in the production build.
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ).default;

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;

    let doc: import('jspdf').jsPDF | null = null;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      // Cap the longest edge at ~MAX_EDGE px; never upscale.
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1, MAX_EDGE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const w = Math.max(1, Math.round(viewport.width));
      const h = Math.max(1, Math.round(viewport.height));
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      // White matte so any transparent regions flatten cleanly to JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
      );
      if (!blob) return file;
      const jpeg = new Uint8Array(await blob.arrayBuffer());

      // One page per source page; page dims in pt map 1:1 from the pixel canvas.
      if (!doc) {
        doc = new jsPDF({ unit: 'pt', format: [w, h] });
      } else {
        doc.addPage([w, h]);
      }
      doc.addImage(jpeg, 'JPEG', 0, 0, w, h);
    }

    if (!doc) return file;

    const rebuilt = doc.output('blob');

    // Never bloat: text-heavy / already-small PDFs rasterise larger, so in that
    // case keep the original.
    if (!rebuilt || rebuilt.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'document';
    return new File([rebuilt], `${baseName}.pdf`, { type: 'application/pdf' });
  } catch {
    // Any failure whatsoever — decode error, worker failure, OOM — falls back to
    // the untouched original so the upload always proceeds.
    return file;
  }
}
