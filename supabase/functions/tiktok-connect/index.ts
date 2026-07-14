// tiktok-connect — one-time connector for the "Lumina Lead Sync" TikTok
// Marketing API app (app id 7660829133971718161, approved 2026-07-14).
//
// Drives the four Marketing API calls that wire TikTok lead ads DIRECTLY to
// the tiktok-receiver webhook (replacing the Make.com relay):
//   {action:'exchange', auth_code}  → oauth2/access_token → store the LONG-TERM
//                                     token in integration_settings 'tiktok_api'
//   {action:'subscribe'}            → subscription/subscribe (LEAD → receiver)
//   {action:'status'}               → subscription/get (list what's subscribed)
//   {action:'mock'}                 → page/lead/mock/create (E2E test lead)
//   {action:'mock_delete'}          → page/lead/mock/delete (one mock per form)
//
// Secrets: TIKTOK_APP_ID + TIKTOK_APP_SECRET from env (pasted ONCE into the
// Supabase dashboard by the owner). The access token lives in
// integration_settings config — responses only ever return MASKED values.
// Auth: staff JWT (admin / F&I / senior F&I) or the internal key.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const API = "https://business-api.tiktok.com/open_api/v1.3";
const ADVERTISER_ID = "7163948356417552385"; // Zinan Volkswagen Sales1109
const PAGE_ID = "7643847475366904072";       // "Working LA Form Copy" — Lumina's form ONLY
const CALLBACK = "https://gkghazemorbxmzzcbaty.supabase.co/functions/v1/tiktok-receiver";
const SETTINGS_KEY = "tiktok_api";

const ALLOWED_ROLES = new Set(["admin", "f_and_i", "senior_f_and_i"]);

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function corsHeaders(origin: string | null, requestedHeaders?: string | null): Record<string, string> {
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

async function requireStaff(req: Request, cors: Record<string, string>): Promise<Response | null> {
  const internal = Deno.env.get("LUMINA_INTERNAL_API_KEY");
  if (internal && req.headers.get("x-lumina-key") === internal) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return unauthorized(cors, "missing bearer token");
  try {
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data: userData, error } = await anon.auth.getUser(token);
    if (error || !userData?.user) return unauthorized(cors, "invalid token");
    const { data: roles } = await svc().from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles || []).some((r: any) => ALLOWED_ROLES.has(r.role))) return unauthorized(cors, "insufficient role");
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

const mask = (s: string) => (s ? s.slice(0, 4) + "…" + s.slice(-4) : "");

async function tikTok(method: "GET" | "POST", path: string, opts: { query?: Record<string, string>; body?: any; accessToken?: string } = {}): Promise<any> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(opts.query || {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.accessToken) headers["Access-Token"] = opts.accessToken;
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch (_) { /* noop */ }
  if (!j) throw new Error(`TikTok ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return j;
}

async function getStored(): Promise<any> {
  const { data } = await svc().from("integration_settings").select("config").eq("key", SETTINGS_KEY).maybeSingle();
  return data?.config || {};
}
async function store(patch: any): Promise<void> {
  const db = svc();
  const current = await getStored();
  const config = { ...current, ...patch };
  const { error } = await db.from("integration_settings").upsert(
    { key: SETTINGS_KEY, active: true, config },
    { onConflict: "key" },
  );
  if (error) throw error;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;
  if (req.method !== "POST") return json(cors, 405, { ok: false, error: "use POST" });

  const appId = Deno.env.get("TIKTOK_APP_ID") || "";
  const secret = Deno.env.get("TIKTOK_APP_SECRET") || "";

  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    if (!appId || !secret) {
      return json(cors, 200, {
        ok: false, error: "secrets_missing",
        detail: "Set TIKTOK_APP_ID and TIKTOK_APP_SECRET in Supabase → Edge Functions → Secrets first.",
        have: { TIKTOK_APP_ID: !!appId, TIKTOK_APP_SECRET: !!secret },
      });
    }

    // ---- 1) auth_code → LONG-TERM access token (never expires; revocable) ----
    if (action === "exchange") {
      const auth_code = String(b.auth_code || "").trim();
      if (!auth_code) return json(cors, 400, { ok: false, error: "auth_code required" });
      const r = await tikTok("POST", "/oauth2/access_token/", { body: { app_id: appId, secret, auth_code } });
      if (r.code !== 0 || !r.data?.access_token) {
        return json(cors, 200, { ok: false, step: "exchange", tiktok: { code: r.code, message: r.message } });
      }
      await store({
        access_token: r.data.access_token,
        advertiser_ids: r.data.advertiser_ids || null,
        scope: r.data.scope || null,
        exchanged_at: new Date().toISOString(),
      });
      return json(cors, 200, {
        ok: true, step: "exchange",
        token: mask(r.data.access_token),
        advertiser_ids: r.data.advertiser_ids || [],
        scope: r.data.scope || null,
      });
    }

    // ---- 2) subscribe LEAD events for the Lumina form → tiktok-receiver ----
    if (action === "subscribe") {
      const cfg = await getStored();
      if (!cfg.access_token) return json(cors, 200, { ok: false, error: "no access_token stored — run exchange first" });
      const r = await tikTok("POST", "/subscription/subscribe/", {
        body: {
          app_id: appId,
          secret,
          subscribe_entity: "LEAD",
          callback_url: CALLBACK,
          subscription_detail: {
            access_token: cfg.access_token,
            advertiser_id: ADVERTISER_ID,
            page_id: PAGE_ID,
          },
        },
      });
      if (r.code === 0) {
        await store({ subscription: r.data || true, subscribed_at: new Date().toISOString() });
      }
      return json(cors, 200, { ok: r.code === 0, step: "subscribe", tiktok: { code: r.code, message: r.message, data: r.data } });
    }

    // ---- current subscriptions on this app ----
    if (action === "status") {
      const r = await tikTok("GET", "/subscription/get/", {
        query: { app_id: appId, secret, page_size: "20", page: "1" },
      });
      return json(cors, 200, { ok: r.code === 0, step: "status", tiktok: { code: r.code, message: r.message, data: r.data } });
    }

    // ---- E2E: mock lead ("Jane Doe") pushed through the real webhook ----
    if (action === "mock" || action === "mock_delete") {
      const cfg = await getStored();
      if (!cfg.access_token) return json(cors, 200, { ok: false, error: "no access_token stored — run exchange first" });
      const path = action === "mock" ? "/page/lead/mock/create/" : "/page/lead/mock/delete/";
      const r = await tikTok("POST", path, {
        accessToken: cfg.access_token,
        body: { advertiser_id: ADVERTISER_ID, page_id: PAGE_ID, ...(b.extra || {}) },
      });
      return json(cors, 200, { ok: r.code === 0, step: action, tiktok: { code: r.code, message: r.message, data: r.data } });
    }

    return json(cors, 400, { ok: false, error: "unknown action", actions: ["exchange", "subscribe", "status", "mock", "mock_delete"] });
  } catch (e) {
    console.error("tiktok-connect error:", e);
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
