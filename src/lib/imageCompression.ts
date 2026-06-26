/**
 * Browser-side image compression for uploads.
 *
 * Phone cameras produce 8-12 MB photos. Storing those raw fills Supabase Storage
 * fast and wastes egress. This resizes to a sensible web dimension and re-encodes
 * as JPEG before upload, typically cutting file size by 80-95% with no visible
 * quality loss for inventory/listing photos.
 *
 * Dependency-free: uses createImageBitmap + canvas (handles EXIF orientation via
 * `imageOrientation: 'from-image'`). Non-image files (PDFs, etc.) pass through
 * untouched, so it is safe to wrap any upload.
 */

export interface CompressImageOptions {
  /** Longest edge in pixels. Images larger than this are scaled down. Default 1920. */
  maxDimension?: number;
  /** JPEG quality, 0-1. Default 0.82. */
  quality?: number;
  /** Output mime type. Default 'image/jpeg'. */
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULTS: Required<CompressImageOptions> = {
  maxDimension: 1920,
  quality: 0.82,
  mimeType: 'image/jpeg',
};

// Formats we should not touch: vector, animated, or already-tiny/transparent assets.
const SKIP_TYPES = new Set(['image/svg+xml', 'image/gif']);

function extensionFor(mimeType: string): string {
  return mimeType === 'image/webp' ? 'webp' : 'jpg';
}

/**
 * Compress a single image File. Returns a new File (re-encoded, smaller) for raster
 * images, or the original File unchanged for non-images / unsupported types / cases
 * where compression would not help.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...options };

  // Pass through anything that isn't a raster image we want to recompress.
  if (!file.type.startsWith('image/') || SKIP_TYPES.has(file.type)) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Some browsers/files reject the options bag; retry without it.
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      // Could not decode (corrupt/unsupported) — upload original rather than fail.
      return file;
    }
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // White matte so transparent PNGs don't turn black when flattened to JPEG.
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality),
    );

    // If encoding failed or didn't actually shrink the file, keep the original.
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^./\\]+$/, '') || 'image';
    return new File([blob], `${baseName}.${extensionFor(mimeType)}`, {
      type: mimeType,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

/** Compress many images, preserving order. Failures fall back to the original file. */
export function compressImages(
  files: File[],
  options?: CompressImageOptions,
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)));
}
