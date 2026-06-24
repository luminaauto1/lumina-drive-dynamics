// LuminaTaskOS — morning pre-approval doc-chase digest. Cron-driven (~every 15 min);
// for each linked user, when their LOCAL clock hits 09:00 (override via
// settings.preapproval_hour), it DMs one Telegram message per PRE-APPROVED finance
// deal that still needs documents requested, each with inline buttons:
//   [✅ Contacted]  → flips finance_applications.docs_contacted (the same flag the
//                     Finance tab uses), handled in taskos-telegram-webhook.
//   [⏳ Not yet]    → keeps it pending; it resurfaces tomorrow.
// Dedupe is atomic via taskos_briefings (user, kind='preapproval', for_date).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";
import { sendTelegram } from "../_shared/taskos/telegram.ts";

function localParts(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date())) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

// A pre-approved deal still needs a doc-chase if it was never contacted, or the
// "contacted" tick is older than 20h (mirrors the Finance tab's 20h auto-reset) — so
// it's re-chased each morning until the docs arrive (status moves off pre_approved).
function needsContact(a: any): boolean {
  if (!a.docs_contacted) return true;
  const at = a.docs_contacted_at ? new Date(a.docs_contacted_at).getTime() : 0;
  return !at || (Date.now() - at > 20 * 60 * 60 * 1000);
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(SUPABASE_URL, SERVICE);

  // Auth: internal key OR cron secret (same as the other taskos cron functions).
  const keyGuard = checkInternalKey(req);
  if (keyGuard && !(await checkCronSecret(req, svc))) return keyGuard;

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ ok: false, reason: "TELEGRAM_BOT_TOKEN not set" });

  const force = await req.json().then((b) => b?.force === true).catch(() => false);

  try {
    const { data: links } = await svc.from("taskos_telegram_links")
      .select("user_id, telegram_chat_id").eq("is_active", true);
    const { data: settingsRows } = await svc.from("taskos_user_settings").select("user_id, timezone, settings");
    const settingsByUser = new Map<string, any>();
    for (const s of settingsRows ?? []) settingsByUser.set(s.user_id, s);

    let sent = 0;
    for (const l of links ?? []) {
      const s = settingsByUser.get(l.user_id);
      const tz = s?.timezone ?? "Africa/Johannesburg";
      const preHour = Number(s?.settings?.preapproval_hour ?? 9);
      const { date, hour } = localParts(tz);
      if (!force && hour !== preHour) continue;

      // Atomic once-per-morning claim (skip if already sent today, unless forced).
      const { error: claimErr } = await svc.from("taskos_briefings")
        .insert({ user_id: l.user_id, kind: "preapproval", for_date: date });
      if (claimErr && !force) continue;

      // Pre-approved deals dealership-wide that still need documents requested.
      const { data: apps } = await svc.from("finance_applications")
        .select("id, first_name, last_name, full_name, phone, bank_reference, docs_contacted, docs_contacted_at, is_archived, status")
        .eq("status", "pre_approved").order("status_updated_at", { ascending: true });
      const pending = (apps ?? []).filter((a: any) => !a.is_archived && needsContact(a));

      if (pending.length === 0) {
        await sendTelegram(token, l.telegram_chat_id, "☀️ Pre-approval check: every pre-approved client has been contacted for documents. Nice — nothing to chase.");
        sent++;
        continue;
      }

      await sendTelegram(token, l.telegram_chat_id,
        `☀️ Pre-approval follow-ups — ${pending.length} client${pending.length === 1 ? "" : "s"} still need documents requested. Have you contacted them?`);
      for (const a of pending) {
        const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || a.full_name || "Client";
        const bits = [a.phone ? `📞 ${a.phone}` : null, a.bank_reference ? `Ref ${a.bank_reference}` : null].filter(Boolean).join(" · ");
        await sendTelegram(token, l.telegram_chat_id,
          `📋 ${name}${bits ? `\n${bits}` : ""}\nPre-approved — request their documents.`,
          { replyMarkup: { inline_keyboard: [[
            { text: "✅ Contacted", callback_data: `pa_done:${a.id}` },
            { text: "⏳ Not yet", callback_data: `pa_skip:${a.id}` },
          ]] } });
      }
      sent++;
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("[taskos-preapproval-digest]", e instanceof Error ? e.message : e);
    return json({ error: "digest run failed" }, 500);
  }
});
