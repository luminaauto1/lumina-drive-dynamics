// authz.ts — staff guard for the chat control-panel endpoints.
// Same posture as other admin edge functions in this repo: verify the caller's
// Supabase JWT and require an allowed role (admin / F&I / senior F&I).
// Batch/cron paths may alternatively present the internal shared key.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { svc } from "./kb.ts";

const ALLOWED_ROLES = new Set(["admin", "f_and_i", "senior_f_and_i"]);

export function corsHeaders(origin: string | null, requestedHeaders?: string | null): Record<string, string> {
  // BULLETPROOF PREFLIGHT (same pattern as _shared/publicGuard.ts): echo back
  // exactly the headers the browser says it will send. This survives any
  // supabase-js version (or app client) adding a new custom header — the
  // recurring cause of "Failed to send a request to the Edge Function".
  const allowHeaders = requestedHeaders && requestedHeaders.trim().length > 0
    ? requestedHeaders
    : "authorization, x-client-info, apikey, content-type, x-lumina-key, x-supabase-api-version, x-region, x-application-name";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

/** Returns null when authorised; otherwise a 401 Response. */
export async function requireStaff(req: Request, cors: Record<string, string>): Promise<Response | null> {
  // internal key path (cron / server-to-server)
  const internal = Deno.env.get("LUMINA_INTERNAL_API_KEY");
  if (internal && req.headers.get("x-lumina-key") === internal) return null;

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return unauthorized(cors, "missing bearer token");

  try {
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: userData, error } = await anon.auth.getUser(token);
    if (error || !userData?.user) return unauthorized(cors, "invalid token");
    const { data: roles } = await svc().from("user_roles").select("role").eq("user_id", userData.user.id);
    const ok = (roles || []).some((r: any) => ALLOWED_ROLES.has(r.role));
    if (!ok) return unauthorized(cors, "insufficient role");
    return null;
  } catch (_e) {
    return unauthorized(cors, "auth check failed");
  }
}

function unauthorized(cors: Record<string, string>, detail: string): Response {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized", detail }), {
    status: 401, headers: { ...cors, "Content-Type": "application/json" },
  });
}
