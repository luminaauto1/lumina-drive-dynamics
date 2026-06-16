// LuminaTaskOS — per-user Telegram linking (JWT-required).
// actions: create_code | status | unlink. user_id is ALWAYS the JWT subject,
// never taken from the request body (cross-user safety, finding C3/D4).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/publicGuard.ts";

const STAFF_ROLES = ["admin", "sales_agent", "f_and_i", "senior_f_and_i", "accountant"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no ambiguous 0/O/1/I
const CODE_LEN = 8; // 8 * 5 bits = 40 bits of entropy
const CODE_TTL_MIN = 10;

function genCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Resolve the caller from their JWT.
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(SUPABASE_URL, SERVICE);

    // Staff gate (defense-in-depth; RLS also enforces is_staff).
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role));
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const { action } = await req.json().catch(() => ({ action: "status" }));

    if (action === "status") {
      const { data: link } = await svc.from("taskos_telegram_links")
        .select("telegram_username, telegram_chat_id, linked_at, last_seen_at")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      return json({ linked: !!link, link: link ?? null });
    }

    if (action === "unlink") {
      await svc.from("taskos_telegram_links").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    if (action === "create_code") {
      // Invalidate any previous unused codes for this user.
      await svc.from("taskos_link_codes").update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id).is("consumed_at", null);

      const code = genCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
      const { error: insErr } = await svc.from("taskos_link_codes")
        .insert({ code, user_id: user.id, expires_at: expiresAt });
      if (insErr) throw insErr;

      const bot = Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "";
      return json({
        code,
        bot_username: bot,
        deep_link: bot ? `https://t.me/${bot}?start=${code}` : null,
        expires_at: expiresAt,
        ttl_minutes: CODE_TTL_MIN,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[taskos-telegram-link]", e instanceof Error ? e.message : e);
    return json({ error: "Internal error" }, 500);
  }
});
