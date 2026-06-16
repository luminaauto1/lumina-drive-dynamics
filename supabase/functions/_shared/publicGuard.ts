// Shared guard for public (unauthenticated) edge functions.
// Validates an internal shared API key + origin to rate-raise abuse without
// breaking unauthenticated public flows (finance applications, sell-car, etc.)

// MIGRATION NOTE (Lovable -> Vercel): the new Vercel production domain MUST be
// listed here, otherwise approved-origin reflection falls back to "*" for the
// public lead-capture / finance / sell-car endpoints. Update the vercel.app
// entry below if your Vercel project name differs, then redeploy the edge
// functions (supabase functions deploy). The lovable.app entry can be removed
// once the Lovable site is retired.
const ALLOWED_ORIGINS = [
  "https://luminaauto.co.za",
  "https://www.luminaauto.co.za",
  "https://lumina-drive-dynamics.vercel.app",
  "https://lumina-auto.lovable.app",
];

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Explicit list (NOT "*"): the CORS spec excludes Authorization from the "*"
  // wildcard, so it must be named. The supabase-js client also sends
  // x-supabase-api-version, which the legacy list omitted — that broke the
  // preflight for browser invoke() calls.
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lumina-key, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function buildCorsHeaders(origin: string | null) {
  // Reflect approved origins; fall back to wildcard for tools/preview.
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ? origin : "*";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowed,
    Vary: "Origin",
  };
}

/**
 * Validates the internal API key passed by the frontend.
 * Returns null on success or a Response on failure.
 *
 * Note: This is a defense-in-depth shared secret bundled into the public
 * frontend. It raises the bar against scripted abuse but is not a true
 * server-only secret. Combine with rate limiting and origin checks.
 */
export function checkInternalKey(req: Request): Response | null {
  const expected = Deno.env.get("LUMINA_INTERNAL_API_KEY");
  if (!expected || expected.trim() === "") {
    // FAIL-CLOSED: refuse all requests if the shared secret is not configured.
    console.error("LUMINA_INTERNAL_API_KEY not set — refusing request (fail-closed)");
    const headers = buildCorsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: internal API key not set" }),
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }

  const provided =
    req.headers.get("x-lumina-key") ||
    req.headers.get("X-Lumina-Key") ||
    "";

  if (provided !== expected) {
    const headers = buildCorsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  }
  return null;
}
