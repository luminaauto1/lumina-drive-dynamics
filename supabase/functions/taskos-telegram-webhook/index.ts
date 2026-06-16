// LuminaTaskOS — Telegram webhook (PRIMARY interface). verify_jwt=false; gated
// ONLY by the X-Telegram-Bot-Api-Secret-Token header (constant-time, fail-closed).
// Per-user isolation: a chat is resolved to exactly one user via
// taskos_telegram_links; unknown chats are rejected. user_id for captured rows
// always comes from the chat->user map, NEVER from message content.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { downloadTelegramFile } from "../_shared/taskos/telegram.ts";
import { transcribeAudio, transcriptionAvailable } from "../_shared/taskos/transcribe.ts";

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

const TG_API = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  try {
    await fetch(TG_API(token, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("[taskos-tg] sendMessage failed", e instanceof Error ? e.message : e);
  }
}

const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // 1. Secret-token gate FIRST (fail-closed).
  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("[taskos-tg] TELEGRAM_WEBHOOK_SECRET not set — refusing (fail-closed)");
    return new Response("Server misconfigured", { status: 500 });
  }
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!ctEqual(gotSecret, expectedSecret)) return new Response("Unauthorized", { status: 401 });

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(SUPABASE_URL, SERVICE);

  let update: any;
  try { update = await req.json(); } catch { return ok(); } // don't trigger Telegram retries

  // 5. Dedupe by update_id.
  if (update?.update_id != null) {
    const { error: dErr } = await svc.from("webhook_events")
      .insert({ event_id: `tg:${update.update_id}`, source: "telegram" });
    if (dErr && (dErr as any).code === "23505") return ok(); // already processed
  }

  const msg = update?.message ?? update?.edited_message;
  const chat = msg?.chat;
  const from = msg?.from;

  // 6. Only private 1:1 chats; chat.id must equal the sender id (rejects groups/channels).
  if (!chat || chat.type !== "private" || !from || chat.id !== from.id) return ok();

  const chatId: number = chat.id;
  const text: string = (msg?.text ?? msg?.caption ?? "").trim();

  // 8. /start <code> — redeem a link code.
  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (!code) { await sendMessage(botToken, chatId, "Welcome to LuminaTaskOS. Open the admin panel → TaskOS → Settings to generate a link code, then tap the link."); return ok(); }

    const { data: codeRow } = await svc.from("taskos_link_codes")
      .select("user_id, expires_at, consumed_at").eq("code", code).maybeSingle();
    if (!codeRow || codeRow.consumed_at || new Date(codeRow.expires_at) < new Date()) {
      await sendMessage(botToken, chatId, "That link code is invalid or expired. Generate a fresh one in the admin panel → TaskOS → Settings.");
      return ok();
    }
    // Atomic single-use claim.
    const { data: claimed } = await svc.from("taskos_link_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("code", code).is("consumed_at", null).select("user_id").maybeSingle();
    if (!claimed) { await sendMessage(botToken, chatId, "That code was just used. Generate a fresh one."); return ok(); }
    const claimedUserId: string = claimed.user_id;

    // Is this chat already linked?
    const { data: existing } = await svc.from("taskos_telegram_links")
      .select("user_id").eq("telegram_chat_id", chatId).maybeSingle();
    if (existing && existing.user_id !== claimedUserId) {
      await sendMessage(botToken, chatId, "This Telegram chat is already linked to a different account. That user must /unlink first.");
      return ok();
    }
    if (existing) {
      await svc.from("taskos_telegram_links").update({
        is_active: true, telegram_user_id: from.id, telegram_username: from.username ?? null,
        linked_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
      }).eq("telegram_chat_id", chatId);
    } else {
      // Free the user's previous active link (one active link per user), then insert.
      await svc.from("taskos_telegram_links").delete().eq("user_id", claimedUserId);
      await svc.from("taskos_telegram_links").insert({
        user_id: claimedUserId, telegram_chat_id: chatId, telegram_user_id: from.id,
        telegram_username: from.username ?? null, is_active: true, last_seen_at: new Date().toISOString(),
      });
    }
    await sendMessage(botToken, chatId, "✅ Linked. Everything you send here now goes to your private LuminaTaskOS inbox — notes, tasks, reminders, ideas. Just type naturally.");
    return ok();
  }

  // 9. Resolve owner (THE isolation gate).
  const { data: link } = await svc.from("taskos_telegram_links")
    .select("user_id").eq("telegram_chat_id", chatId).eq("is_active", true).maybeSingle();
  if (!link) {
    await sendMessage(botToken, chatId, "This chat isn't linked yet. Open the admin panel → TaskOS → Settings → Connect Telegram.");
    return ok();
  }
  const ownerUserId: string = link.user_id;

  // 10. /unlink
  if (text.startsWith("/unlink")) {
    await svc.from("taskos_telegram_links").delete().eq("telegram_chat_id", chatId).eq("user_id", ownerUserId);
    await sendMessage(botToken, chatId, "Disconnected. This chat is no longer linked to your TaskOS.");
    return ok();
  }

  // Touch last_seen.
  await svc.from("taskos_telegram_links").update({ last_seen_at: new Date().toISOString() }).eq("telegram_chat_id", chatId);

  // 12. Per-user rate-limit (cheap; uses the user/status index).
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await svc.from("taskos_inbox_items")
    .select("id", { count: "exact", head: true }).eq("user_id", ownerUserId).gte("created_at", since);
  if ((count ?? 0) > 20) { await sendMessage(botToken, chatId, "You're sending a lot very fast — give me a moment to catch up."); return ok(); }

  // 11. Capture into the owner's inbox (user_id from the chat->user map, never the body).
  const mediaKind = msg?.voice ? "voice" : (msg?.photo ? "photo" : (msg?.document ? "document" : "text"));
  const mediaRef = msg?.voice?.file_id ?? msg?.photo?.[msg.photo.length - 1]?.file_id ?? msg?.document?.file_id ?? null;

  // Voice notes: transcribe (if an STT key is configured) and route the text
  // through the normal AI pipeline; otherwise save for manual review.
  let captureText = text;
  if (msg?.voice) {
    if (transcriptionAvailable()) {
      const file = await downloadTelegramFile(botToken, msg.voice.file_id);
      const transcript = file ? await transcribeAudio(file.bytes, "voice.ogg") : null;
      if (transcript) {
        captureText = transcript;
      } else {
        await svc.from("taskos_inbox_items").insert({
          user_id: ownerUserId, source: "telegram", raw_text: null, media_kind: "voice", media_ref: mediaRef,
          external_id: `tg:${chatId}:${msg.message_id}`, status: "needs_review",
          payload: { note: "voice transcription failed" },
        });
        await sendMessage(botToken, chatId, "🎙️ Saved your voice note, but I couldn't transcribe it this time. You can also type it.");
        return ok();
      }
    } else {
      await svc.from("taskos_inbox_items").insert({
        user_id: ownerUserId, source: "telegram", raw_text: null, media_kind: "voice", media_ref: mediaRef,
        external_id: `tg:${chatId}:${msg.message_id}`, status: "needs_review",
        payload: { note: "voice capture; transcription not configured (set OPENAI_API_KEY)" },
      });
      await sendMessage(botToken, chatId, "🎙️ Saved your voice note. Voice transcription isn't switched on yet — for now send text and I'll organise it instantly.");
      return ok();
    }
  } else if (mediaKind !== "text") {
    // Photos / documents: store the reference; vision understanding is a later phase.
    await svc.from("taskos_inbox_items").insert({
      user_id: ownerUserId, source: "telegram", raw_text: text || null, media_kind: mediaKind, media_ref: mediaRef,
      external_id: `tg:${chatId}:${msg.message_id}`, status: "needs_review",
      payload: { note: "media capture; understanding pending" },
    });
    await sendMessage(botToken, chatId, "📎 Saved. Photo/document understanding is coming soon — for now send text or a voice note.");
    return ok();
  }

  if (!captureText) return ok();

  const { data: inboxRow, error: insErr } = await svc.from("taskos_inbox_items")
    .insert({ user_id: ownerUserId, source: "telegram", raw_text: captureText, media_kind: msg?.voice ? "voice" : "text", media_ref: msg?.voice ? mediaRef : null, external_id: `tg:${chatId}:${msg.message_id}`, status: "pending" })
    .select("id").maybeSingle();
  if (insErr && (insErr as any).code === "23505") return ok(); // duplicate message

  await sendMessage(botToken, chatId, msg?.voice ? `🎙️ Got it: “${captureText.slice(0, 80)}${captureText.length > 80 ? "…" : ""}” — organising now.` : "Captured ✓ — organising it now.");

  // 13. Fire-and-forget AI processing with the inbox id ONLY (never user_id from body).
  if (inboxRow?.id) {
    const p = fetch(`${SUPABASE_URL}/functions/v1/taskos-process-inbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE}`,
        "x-lumina-key": Deno.env.get("LUMINA_INTERNAL_API_KEY") ?? "",
      },
      body: JSON.stringify({ inbox_item_id: inboxRow.id }),
    }).catch((e) => console.error("[taskos-tg] trigger AI", e instanceof Error ? e.message : e));
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
  }

  return ok();
});
