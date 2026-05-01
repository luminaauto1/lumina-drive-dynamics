import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'lumina_attribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  referrer: string | null;
  landing_page?: string | null;
  captured_at?: string;
}

/**
 * Global hook — captures UTM params from URL on every navigation
 * and persists them in sessionStorage for the duration of the visit.
 * First-touch attribution: only writes if not already captured.
 */
export const useUTMTracking = () => {
  const location = useLocation();

  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const hasAnyUtm = UTM_KEYS.some((k) => sp.get(k));
      const existing = sessionStorage.getItem(STORAGE_KEY);

      // First-touch: only set if not already stored, OR if a fresh utm appears
      if (hasAnyUtm) {
        const referrer = (() => {
          try {
            return document.referrer ? new URL(document.referrer).hostname : null;
          } catch { return null; }
        })();

        const attribution: Attribution = {
          utm_source: sp.get('utm_source'),
          utm_medium: sp.get('utm_medium'),
          utm_campaign: sp.get('utm_campaign'),
          utm_term: sp.get('utm_term'),
          utm_content: sp.get('utm_content'),
          referrer,
          landing_page: location.pathname,
          captured_at: new Date().toISOString(),
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
      } else if (!existing) {
        // No UTM and nothing stored — capture referrer-only attribution
        const referrer = (() => {
          try {
            return document.referrer ? new URL(document.referrer).hostname : null;
          } catch { return null; }
        })();
        if (referrer) {
          const attribution: Attribution = {
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            referrer,
            landing_page: location.pathname,
            captured_at: new Date().toISOString(),
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
        }
      }
    } catch (e) {
      // Silent fail — never break user flow for analytics
      console.warn('UTM tracking error:', e);
    }
  }, [location.pathname, location.search]);
};

/**
 * Retrieve stored attribution for inclusion in DB payloads.
 * Returns an object safe to spread into leads / finance_applications inserts.
 */
export const getStoredAttribution = (): Pick<Attribution, 'utm_source' | 'utm_medium' | 'utm_campaign' | 'referrer'> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Fallback: parse current URL inline
      const sp = new URLSearchParams(window.location.search);
      return {
        utm_source: sp.get('utm_source'),
        utm_medium: sp.get('utm_medium'),
        utm_campaign: sp.get('utm_campaign'),
        referrer: (() => {
          try { return document.referrer ? new URL(document.referrer).hostname : null; }
          catch { return null; }
        })(),
      };
    }
    const parsed = JSON.parse(raw) as Attribution;
    return {
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
      referrer: parsed.referrer ?? null,
    };
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null, referrer: null };
  }
};
