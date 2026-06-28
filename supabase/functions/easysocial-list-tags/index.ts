// EasySocial List Tags — admin-only tag dictionary fetch + cache.
//
// Pulls the live EasySocial tag list (name → id) using the SAME key resolution
// and fetch as easysocial-tag-sync (shared via ../_shared/easysocialTags.ts), then
// persists it into integration_settings.config.tags_cache + tags_synced_at so the
// Settings UI can offer a validated tag picker instead of free-text.
//
// Auth: Supabase user JWT, verified is_admin via the service client (user_roles
// role='admin') — this is an authenticated admin-settings action, NOT a public
// capture flow. No request body required.
//
// Response: { ok, tags: [{ name, id }], count, synced_at }
//
// Side-effect: merge-writes integration_settings (key='easysocial'), preserving
// api_key / tag_add_overrides / any other config siblings. Additive + reversible.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchTagDictionary, resolveEasySocialSettings } from "../_shared/easysocialTags.ts";

// Reflect whatever headers the browser asks for in the CORS preflight (mirrors
// invite-sales-agent — supabase-js sends headers beyond a fixed allow-list).
const buildCors = (req: Request) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    req.headers.get("access-control-request-headers") ??
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // --- Admin JWT gate -------------------------------------------------------
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json(401, { error: "Missing auth" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Invalid token" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json(403, { error: "Forbidden — admin only" });

    // --- Fetch tags (shared key resolution + fetch) ---------------------------
    const { apiKey, config } = await resolveEasySocialSettings();

    let dict: Record<string, number>;
    try {
      dict = await fetchTagDictionary(apiKey);
    } catch (e) {
      console.error("[list-tags] tag dictionary fetch failed", String((e as Error).message ?? e));
      return json(200, { ok: false, error: "tag_dictionary_fetch_failed", detail: String((e as Error).message ?? e) });
    }

    const tags = Object.entries(dict)
      .map(([name, id]) => ({ name, id }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const synced_at = new Date().toISOString();

    // --- Persist to integration_settings.config (merge-write) -----------------
    // Preserve api_key / tag_add_overrides / any other siblings; only set the
    // cache fields. additive + reversible (config is jsonb, no schema change).
    try {
      const nextConfig = { ...(config ?? {}), tags_cache: tags, tags_synced_at: synced_at };
      const { error: upErr } = await admin
        .from("integration_settings")
        .upsert({ key: "easysocial", config: nextConfig, updated_at: synced_at }, { onConflict: "key" });
      if (upErr) console.error("[list-tags] config cache write failed", upErr.message);
    } catch (e) {
      console.error("[list-tags] config cache write threw", String((e as Error).message ?? e));
    }

    console.log("[list-tags] OK", { count: tags.length, by: userData.user.id });
    return json(200, { ok: true, tags, count: tags.length, synced_at });
  } catch (e: any) {
    return json(500, { error: e?.message || "Unknown error" });
  }
});
