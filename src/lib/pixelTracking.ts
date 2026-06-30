/**
 * Isolated Pixel Tracking — Meta (Facebook/Instagram) + TikTok
 *
 * STRICT ISOLATION: This module never touches Supabase, the CRM, or any
 * internal analytics. Its sole job is firing client-side events to ad
 * platforms. All calls are wrapped in try/catch so a failed/blocked pixel
 * script can never break the UI.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: {
      page: () => void;
      track: (event: string, params?: Record<string, any>) => void;
      [key: string]: any;
    };
  }
}

export const trackPageView = () => {
  try {
    window.fbq?.("track", "PageView");
  } catch (e) {
    /* swallow — ad pixel failure must never break UI */
  }
  try {
    window.ttq?.page();
  } catch (e) {
    /* swallow */
  }
};

export const trackLeadConversion = (params?: Record<string, any>, eventId?: string) => {
  try {
    // Meta dedup key is `eventID` in the options arg (mirrors the server CAPI event_id).
    window.fbq?.("track", "Lead", params, eventId ? { eventID: eventId } : undefined);
  } catch (e) {
    /* swallow */
  }
  try {
    // TikTok dedup key is `event_id` in the options arg (mirrors the server CAPI event_id).
    window.ttq?.track("SubmitForm", params, eventId ? { event_id: eventId } : undefined);
  } catch (e) {
    /* swallow */
  }
};
