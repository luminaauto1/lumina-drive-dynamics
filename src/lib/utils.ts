import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Smart image optimizer - only applies Supabase transformations to Supabase Storage URLs
 * Returns original URL for non-Supabase images (safeguard against broken images)
 */
export function getOptimizedImageUrl(url: string, width: number = 600): string {
  if (!url) return url;
  
  // Only apply transformations to Supabase Storage URLs
  const isSupabaseUrl = url.includes('supabase.co/storage') || url.includes('.supabase.in/storage');
  
  if (isSupabaseUrl) {
    // Append query params for Supabase image transformation
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}&resize=cover&quality=80`;
  }
  
  // Return original URL for non-Supabase images
  return url;
}
