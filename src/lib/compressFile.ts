import imageCompression from 'browser-image-compression';

export type CompressionLevel = 'balanced' | 'high' | 'small';

// Tuned presets. "balanced" is the app default chosen for the Documents Hub:
// good readability for IDs / statements / reports at a fraction of the size.
const PRESETS: Record<CompressionLevel, { maxSizeMB: number; maxWidthOrHeight: number; initialQuality: number }> = {
  high:     { maxSizeMB: 2.5, maxWidthOrHeight: 2560, initialQuality: 0.9 },
  balanced: { maxSizeMB: 1.0, maxWidthOrHeight: 2000, initialQuality: 0.8 },
  small:    { maxSizeMB: 0.4, maxWidthOrHeight: 1600, initialQuality: 0.65 },
};

/**
 * Compress raster images before upload. PDFs and every other file type pass
 * through untouched — browser-side PDF recompression isn't safe/reliable, and
 * vector/animated formats (svg/gif) shouldn't be rasterised.
 * Never throws: if compression fails for any reason the original file is returned
 * so an upload is never blocked.
 */
export async function compressIfImage(file: File, level: CompressionLevel = 'balanced'): Promise<File> {
  const isImage = file.type.startsWith('image/');
  if (!isImage) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  try {
    const preset = PRESETS[level];
    const compressed = await imageCompression(file, {
      maxSizeMB: preset.maxSizeMB,
      maxWidthOrHeight: preset.maxWidthOrHeight,
      initialQuality: preset.initialQuality,
      useWebWorker: true,
    });
    // Only keep the compressed version if it's actually smaller.
    if (compressed.size < file.size) {
      return new File([compressed], file.name, { type: compressed.type || file.type });
    }
    return file;
  } catch {
    return file;
  }
}

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
