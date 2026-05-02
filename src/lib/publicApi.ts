// Frontend helper: returns the headers required by public edge functions
// guarded by the LUMINA_INTERNAL_API_KEY shared secret.
//
// NOTE: This key is bundled into the client and is therefore NOT a true
// secret — it is a defense-in-depth gate that raises the bar against trivial
// scripted abuse of public endpoints (sell-car, finance app submissions,
// WhatsApp triggers). True authorization for sensitive actions still happens
// server-side via JWT validation or service-role role checks.
//
// To rotate: change BOTH the value below AND the LUMINA_INTERNAL_API_KEY
// Supabase secret. The two must match exactly.
export const LUMINA_PUBLIC_KEY = "lumina-pub-2026-v1-9f3a";

export function publicApiHeaders(): Record<string, string> {
  return { "x-lumina-key": LUMINA_PUBLIC_KEY };
}
