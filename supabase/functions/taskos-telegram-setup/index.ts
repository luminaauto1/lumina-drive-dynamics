// LuminaTaskOS — Telegram webhook registration / maintenance utility.
// Internal-key gated (x-lumina-key). Re-registers the Telegram webhook so that
// it RECEIVES inline-button taps (callback_query), not just messages.
//
// THE BUG THIS FIXES: the webhook was registered with an allowed_updates list
// that omitted "callback_query", so Telegram delivered text messages (capture
// worked) but silently DROPPED every button tap — the pre-approval ✅/⏳ and
// task done/not-yet buttons "did nothing". setWebhook must list callback_query.
//
// Usage (internal key required):
//   {action:"info"}  (default) → returns getWebhookInfo (inspect current state)
//   {action:"set"}            → re-runs setWebhook with the correct
//                               allowed_updates, then returns getWebhookInfo.
// Auth: internal key (x-lumina-key) OR the DB-held cron secret — so it can be
// triggered from the app OR via the taskos_invoke() SQL helper.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";

const TG = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

// The full set of update types TaskOS needs. callback_query is the critical one
// (inline-button taps); message/edited_message carry captured notes & commands.
const ALLOWED_UPDATES = ["message", "edited_message", "callback_query"];

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Auth: internal key OR cron secret (mirrors the other taskos cron fns, so
  // it's callable via taskos_invoke()).
  const svc = supabaseUrl && service ? createClient(supabaseUrl, service) : null;
  const keyGuard = checkInternalKey(req);
  if (keyGuard && !(svc && (await checkCronSecret(req, svc)))) return keyGuard;

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!token) return json({ ok: false, error: "TELEGRAM_BOT_TOKEN not set" }, 500);
  if (!secret) return json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET not set" }, 500);
  if (!supabaseUrl) return json({ ok: false, error: "SUPABASE_URL not set" }, 500);

  const action = await req.json().then((b) => String(b?.action ?? "info")).catch(() => "info");
  const webhookUrl = `${supabaseUrl}/functions/v1/taskos-telegram-webhook`;

  const getInfo = async () => {
    const r = await fetch(TG(token, "getWebhookInfo"), { method: "GET" });
    return await r.json().catch(() => null);
  };

  try {
    if (action === "set") {
      // Re-register. drop_pending_updates:false so any queued taps still arrive.
      const setRes = await fetch(TG(token, "setWebhook"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ALLOWED_UPDATES,
          drop_pending_updates: false,
          max_connections: 40,
        }),
      });
      const setBody = await setRes.json().catch(() => null);
      const info = await getInfo();
      console.log("[tg-setup] setWebhook", { webhookUrl, setBody, allowed: info?.result?.allowed_updates });
      return json({ ok: setRes.ok && setBody?.ok === true, action: "set", webhookUrl, allowed_updates: ALLOWED_UPDATES, set_result: setBody, info });
    }
    // default: inspect only.
    const info = await getInfo();
    return json({ ok: true, action: "info", webhookUrl, info });
  } catch (e) {
    console.error("[tg-setup] failed", e instanceof Error ? e.message : e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
