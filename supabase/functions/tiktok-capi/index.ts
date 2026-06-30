// TikTok Events API (CAPI) sender — server-side conversion events back to TikTok
// for ad optimization. Mirrors the browser TikTok Pixel using a shared event_id so
// TikTok deduplicates the pair. PII (email/phone) is SHA-256 hashed server-side and
// never logged. Fire-and-forget from the caller: always returns 200, and no-ops if
// TIKTOK_ACCESS_TOKEN is not configured (so it is safe to deploy before setup).
//
// Guarded by the LUMINA_INTERNAL_API_KEY shared secret (x-lumina-key). Deployed with
// verify_jwt = false. Docs: business-api.tiktok.com /open_api/v1.3/event/track/.
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
// TikTok wants E.164 for phone hashing — our numbers are stored as 27XXXXXXXXX.
const normPhone = (p: unknown) => {
  const digits = String(p ?? "").replace(/[^\d]/g, "");
  return digits ? "+" + digits : "";
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin, req.headers.get("access-control-request-headers"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const guard = checkInternalKey(req);
  if (guard) return guard;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const accessToken = Deno.env.get("TIKTOK_ACCESS_TOKEN") || "";
  const pixelCode = Deno.env.get("TIKTOK_PIXEL_CODE") || "";
  // No-op (but ack 200) until the access token + pixel code are configured.
  if (!accessToken || !pixelCode) {
    return json({ ok: true, skipped: "capi_disabled" });
  }

  const event = String(body.event || "SubmitForm");
  const eventId = body.event_id ? String(body.event_id) : crypto.randomUUID();
  const url = body.url ? String(body.url) : (req.headers.get("referer") || undefined);
  const ttclid = body.ttclid ? String(body.ttclid) : undefined;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  const user: Record<string, unknown> = {};
  const email = normEmail(body.email);
  const phone = normPhone(body.phone);
  if (email) user.email = await sha256Hex(email);
  if (phone) user.phone = await sha256Hex(phone);
  if (ttclid) user.ttclid = ttclid;
  if (ip) user.ip = ip;
  if (userAgent) user.user_agent = userAgent;

  const eventPayload = {
    event_source: "web",
    event_source_id: pixelCode,
    data: [{
      event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user,
      ...(url ? { page: { url } } : {}),
      ...(body.properties && typeof body.properties === "object" ? { properties: body.properties } : {}),
    }],
  };

  try {
    const res = await fetch(TIKTOK_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": accessToken },
      body: JSON.stringify(eventPayload),
    });
    const text = await res.text();
    // TikTok returns { code: 0, message: "OK", ... } on success. Log code only (no PII).
    let code: unknown = null;
    try { code = JSON.parse(text)?.code; } catch { /* keep raw */ }
    console.log("[tiktok-capi]", event, "tt_code:", code, "http:", res.status);
    return json({ ok: res.ok, event, event_id: eventId, tt_code: code });
  } catch (e) {
    console.error("[tiktok-capi] send failed:", e);
    // Fire-and-forget contract: never surface an error to the caller's flow.
    return json({ ok: false, error: "send_failed" });
  }
});
