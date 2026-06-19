// LuminaTaskOS — reminder + escalation engine (cron-driven, ~every 5 min).
// Sends Telegram nudges for due reminders and escalates overdue tasks. Per-user
// isolation: each row's owner is resolved to THEIR linked chat via
// taskos_telegram_links — a reminder can only ever go to its own user's chat.
// Gated by the DB-held cron secret (or the internal key for manual runs).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";
import { sendTelegram } from "../_shared/taskos/telegram.ts";

const nowISO = () => new Date().toISOString();

// Format a due timestamp in the user's LOCAL timezone. The edge runtime is UTC,
// so toLocaleString without an explicit timeZone rendered times 2h behind for SAST
// users (e.g. a 09:00 task showed "07:00").
const fmtDue = (iso: string, tz: string) =>
  new Date(iso).toLocaleString("en-ZA", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

// Hours a task is overdue -> desired escalation level (0 = none).
function desiredLevel(hoursOverdue: number): number {
  if (hoursOverdue >= 72) return 4;
  if (hoursOverdue >= 24) return 3;
  if (hoursOverdue >= 6) return 2;
  if (hoursOverdue >= 1) return 1;
  return 0;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(SUPABASE_URL, SERVICE);

  // Auth: cron secret OR internal key.
  const keyGuard = checkInternalKey(req);
  if (keyGuard && !(await checkCronSecret(req, svc))) return keyGuard;

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ ok: false, reason: "TELEGRAM_BOT_TOKEN not set" });

  const now = new Date();
  let sent = 0;
  const MAX_SENDS = 80;

  // Resolve chat for a user lazily, cached.
  const chatCache = new Map<string, number | null>();
  async function chatFor(userId: string): Promise<number | null> {
    if (chatCache.has(userId)) return chatCache.get(userId)!;
    const { data } = await svc.from("taskos_telegram_links")
      .select("telegram_chat_id").eq("user_id", userId).eq("is_active", true).maybeSingle();
    const chat = data?.telegram_chat_id ?? null;
    chatCache.set(userId, chat);
    return chat;
  }

  // Resolve a user's timezone lazily, cached (default SAST).
  const tzCache = new Map<string, string>();
  async function tzFor(userId: string): Promise<string> {
    if (tzCache.has(userId)) return tzCache.get(userId)!;
    const { data } = await svc.from("taskos_user_settings").select("timezone").eq("user_id", userId).maybeSingle();
    const tz = (data?.timezone as string) || "Africa/Johannesburg";
    tzCache.set(userId, tz);
    return tz;
  }

  try {
    // 1. Tasks whose reminder time has arrived and haven't been notified yet.
    const { data: dueTasks } = await svc.from("taskos_tasks")
      .select("id, user_id, title, due_at")
      .lte("remind_at", nowISO()).is("notified_at", null)
      .not("status", "in", "(done,cancelled)").limit(100);
    for (const t of dueTasks ?? []) {
      if (sent >= MAX_SENDS) break;
      const chat = await chatFor(t.user_id);
      if (!chat) { await svc.from("taskos_tasks").update({ notified_at: nowISO(), escalation_level: 1 }).eq("id", t.id); continue; }
      const due = t.due_at ? ` (due ${fmtDue(t.due_at, await tzFor(t.user_id))})` : "";
      const okSend = await sendTelegram(token, chat, `⏰ Reminder: ${t.title}${due}`);
      if (okSend) { await svc.from("taskos_tasks").update({ notified_at: nowISO(), escalation_level: 1 }).eq("id", t.id); sent++; }
    }

    // 2. Entities (reminder/deadline/event/meeting) whose reminder time arrived.
    const { data: dueEnts } = await svc.from("taskos_entities")
      .select("id, user_id, kind, title, due_at")
      .lte("remind_at", nowISO()).is("notified_at", null).limit(100);
    for (const e of dueEnts ?? []) {
      if (sent >= MAX_SENDS) break;
      const chat = await chatFor(e.user_id);
      if (!chat) { await svc.from("taskos_entities").update({ notified_at: nowISO(), escalation_level: 1 }).eq("id", e.id); continue; }
      const due = e.due_at ? ` (${fmtDue(e.due_at, await tzFor(e.user_id))})` : "";
      const okSend = await sendTelegram(token, chat, `⏰ ${e.kind}: ${e.title ?? "(reminder)"}${due}`);
      if (okSend) { await svc.from("taskos_entities").update({ notified_at: nowISO(), escalation_level: 1 }).eq("id", e.id); sent++; }
    }

    // 3. Escalation: overdue, still-open tasks get stronger nudges over time.
    const { data: overdue } = await svc.from("taskos_tasks")
      .select("id, user_id, title, due_at, escalation_level")
      .lt("due_at", nowISO()).not("due_at", "is", null)
      .not("status", "in", "(done,cancelled)").limit(200);
    for (const t of overdue ?? []) {
      if (sent >= MAX_SENDS) break;
      const hrs = (now.getTime() - new Date(t.due_at).getTime()) / 3_600_000;
      const want = desiredLevel(hrs);
      if (want <= (t.escalation_level ?? 0)) continue;
      const chat = await chatFor(t.user_id);
      if (!chat) { await svc.from("taskos_tasks").update({ escalation_level: want }).eq("id", t.id); continue; }
      const days = Math.floor(hrs / 24);
      const ago = days >= 1 ? `${days}d` : `${Math.floor(hrs)}h`;
      const okSend = await sendTelegram(token, chat, `🔴 Overdue ${ago}: ${t.title}\nStill open — knock it out or reschedule it.`);
      if (okSend) { await svc.from("taskos_tasks").update({ escalation_level: want, notified_at: nowISO() }).eq("id", t.id); sent++; }
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error("[taskos-run-reminders]", e instanceof Error ? e.message : e);
    return json({ error: "reminder run failed" }, 500);
  }
});
