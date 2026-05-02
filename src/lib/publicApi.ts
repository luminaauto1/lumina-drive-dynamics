// Frontend helper: returns the headers required by public edge functions
// guarded by the LUMINA_INTERNAL_API_KEY shared secret.
//
// NOTE: This key is bundled into the client and is not a true secret — it is
// a defense-in-depth gate that raises the bar against trivial scripted abuse.
// True authorization for sensitive actions still happens server-side via JWT
// or service-role checks.

export const LUMINA_PUBLIC_KEY = import.meta.env.VITE_LUMINA_INTERNAL_API_KEY || "";

export function publicApiHeaders(): Record<string, string> {
  return LUMINA_PUBLIC_KEY ? { "x-lumina-key": LUMINA_PUBLIC_KEY } : {};
}
