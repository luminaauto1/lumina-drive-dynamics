// Target preview frame. The public VehicleCard uses a 16:10 aspect ratio, so we
// render the prepared cover at that exact shape — the car is scaled to fit
// inside a small uniform margin and centred, so no matter the vehicle's shape it
// fills the frame consistently without any edges being cut off.
const FRAME_W = 1200;
const FRAME_H = 750; // 1200x750 = 16:10
const PADDING = 0.06; // 6% breathing room around the car
const ALPHA_THRESHOLD = 12; // pixels more transparent than this are "background"

/**
 * Remove the background from a vehicle photo, auto-crop to the car, and fit it
 * into the website's preview frame. Returns a transparent WebP blob.
 *
 * @param source A File/Blob (raw upload) or a public image URL.
 */
export async function processCoverImage(source: Blob | string): Promise<Blob> {
  // 1) Cut out the background (transparent PNG). Runs locally in the browser.
  //    Loaded on demand so this heavy engine never weighs down the public site.
  const { removeBackground } = await import('@imgly/background-removal');
  const cutout = await removeBackground(source, { output: { format: 'image/png' } });

  // 2) Draw the cutout and find the car's bounding box (non-transparent pixels).
  const bmp = await createImageBitmap(cutout);
  const work = document.createElement('canvas');
  work.width = bmp.width;
  work.height = bmp.height;
  const wctx = work.getContext('2d');
  if (!wctx) throw new Error('Canvas not supported');
  wctx.drawImage(bmp, 0, 0);

  const { data } = wctx.getImageData(0, 0, bmp.width, bmp.height);
  let minX = bmp.width, minY = bmp.height, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (data[(y * bmp.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) { minX = 0; minY = 0; maxX = bmp.width - 1; maxY = bmp.height - 1; }
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 3) Scale the cropped car to fit the frame within the padding, then centre it.
  const out = document.createElement('canvas');
  out.width = FRAME_W;
  out.height = FRAME_H;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas not supported');

  const availW = FRAME_W * (1 - 2 * PADDING);
  const availH = FRAME_H * (1 - 2 * PADDING);
  const scale = Math.min(availW / cropW, availH / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const dx = (FRAME_W - drawW) / 2;
  const dy = (FRAME_H - drawH) / 2;

  octx.clearRect(0, 0, FRAME_W, FRAME_H); // keep transparent background
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(work, minX, minY, cropW, cropH, dx, dy, drawW, drawH);

  // 4) Export a fast-loading transparent WebP.
  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/webp',
      0.85,
    );
  });
}

/** Marker so we can tell a prepared cover apart from a raw upload. */
export const PREPARED_COVER_SUFFIX = '-cover.webp';

export const isPreparedCover = (url: string | undefined | null): boolean =>
  !!url && url.includes(PREPARED_COVER_SUFFIX);
