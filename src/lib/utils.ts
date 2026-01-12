import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Nuclear image optimizer using wsrv.nl proxy
 * Forces compression and WebP conversion for all images
 */
export function getOptimizedImage(url: string, width: number = 800): string {
  // Return placeholder for missing URLs
  if (!url) return '/placeholder.svg';
  
  // Don't process blob or data URLs
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  
  // Use wsrv.nl proxy for all other images
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=75&output=webp&default=placeholder`;
}

/**
 * Legacy function - redirects to new optimizer
 * @deprecated Use getOptimizedImage instead
 */
export function getOptimizedImageUrl(url: string, width: number = 600): string {
  return getOptimizedImage(url, width);
}
