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
import { editTelegramText, sendTelegram } from "../_shared/taskos/telegram.ts";

function localParts(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date())) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: p.weekday };
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
    const { data: allLinks } = await svc.from("taskos_telegram_links")
      .select("user_id, telegram_chat_id").eq("is_active", true);
    // Owner's rule: only ADMIN users get the pre-approval doc-chase digest. Senior
    // F&I (and other staff) have TaskOS access, but this specific reminder is the
    // admin's chase list — so filter linked users down to the admin role only.
    const { data: adminRoleRows } = await svc.from("user_roles")
      .select("user_id").eq("role", "admin");
    const adminIds = new Set((adminRoleRows ?? []).map((r: any) => r.user_id));
    const links = (allLinks ?? []).filter((l: any) => adminIds.has(l.user_id));
    const { data: settingsRows } = await svc.from("taskos_user_settings").select("user_id, timezone, settings");
    const settingsByUser = new Map<string, any>();
    for (const s of settingsRows ?? []) settingsByUser.set(s.user_id, s);

    const PING_INTERVAL_MS = 55 * 60 * 1000; // re-ask the same client at most ~hourly
    const nameOf = (a: any) => [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || a.full_name || "Client";
    let sent = 0;
    for (const l of links ?? []) {
      const s = settingsByUser.get(l.user_id);
      const tz = s?.timezone ?? "Africa/Johannesburg";
      const preHour = Number(s?.settings?.preapproval_hour ?? 9);       // first ask of the day
      const endHour = Number(s?.settings?.preapproval_end_hour ?? 17);  // stop re-asking at endHour:endMin
      const endMin = Number(s?.settings?.preapproval_end_minute ?? 30); // default 17:30 (owner's rule)
      const { hour, minute, weekday } = localParts(tz);
      const afterEnd = hour > endHour || (hour === endHour && minute >= endMin);
      if (!force && (hour < preHour || afterEnd)) continue;             // only ask within the working window (≤17:30)
      if (!force && (weekday === "Sat" || weekday === "Sun")) continue; // owner's rule: doc-chasing is weekday business

      // Pre-approved deals dealership-wide that still need documents requested
      // (both tracks: traditional + the Flexi non-traditional partner).
      const { data: apps } = await svc.from("finance_applications")
        .select("id, first_name, last_name, full_name, phone, bank_reference, docs_contacted, docs_contacted_at, is_archived, status")
        .in("status", ["pre_approved", "pre_approved_flexi"]).order("status_updated_at", { ascending: true });
      const pending = (apps ?? []).filter((a: any) => !a.is_archived && needsContact(a));
      if (pending.length === 0) continue; // no chase needed → stay quiet

      // Last ping per pending client, so we wait ~1h between asks (and don't double-send
      // within the 15-min cron cadence).
      const ids = pending.map((a: any) => a.id);
      const { data: pingRows } = await svc.from("taskos_preapproval_pings")
        .select("application_id, last_pinged_at, last_message_id").eq("user_id", l.user_id).in("application_id", ids);
      const pingByApp = new Map((pingRows ?? []).map((p: any) => [p.application_id, p]));

      for (const a of pending) {
        const p = pingByApp.get(a.id);
        const due = force || !p || (Date.now() - new Date(p.last_pinged_at).getTime() >= PING_INTERVAL_MS);
        if (!due) continue;
        // Supersede the previous unanswered ask so only the newest is actionable.
        if (p?.last_message_id) {
          await editTelegramText(token, l.telegram_chat_id, p.last_message_id, `📋 ${nameOf(a)} — re-asking below ⤵️`);
        }
        const bits = [a.phone ? `📞 ${a.phone}` : null, a.bank_reference ? `Ref ${a.bank_reference}` : null].filter(Boolean).join(" · ");
        const msgId = await sendTelegram(token, l.telegram_chat_id,
          `📋 ${nameOf(a)}${bits ? `\n${bits}` : ""}\nPre-approved — have you requested their documents?`,
          { replyMarkup: { inline_keyboard: [[
            { text: "✅ Contacted", callback_data: `pa_done:${a.id}` },
            { text: "⏳ Not yet", callback_data: `pa_skip:${a.id}` },
          ]] } });
        await svc.from("taskos_preapproval_pings").upsert({
          user_id: l.user_id, application_id: a.id,
          last_pinged_at: new Date().toISOString(), last_message_id: msgId ?? null,
        });
        sent++;
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("[taskos-preapproval-digest]", e instanceof Error ? e.message : e);
    return json({ error: "digest run failed" }, 500);
  }
});
