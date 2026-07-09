// chat-answer — human-in-the-loop actions for the Chat Control panel.
//
// EasySocial has NO server-side session-send API (verified against
// easysocial.io/docs 2026-07-09), so free-form replies are delivered by the
// HUMAN pasting into the EasySocial chat (the panel copies the text and opens
// the chat). This function records the human's decisions:
//
//   { approveReplyLogId, message? }  → Outbox approve: mark the bot's proposed
//                                      reply row 'sent_manual' (with any edits).
//   { discardReplyLogId }            → Outbox discard: mark row 'discarded'.
//   { leadId, phone, inbound_text, message, escalationId, learn }
//                                    → Needs-you answer: learn it (optional),
//                                      close the escalation, log 'sent_manual'.
//   { toggleLearnedId, active }      → enable/disable a learned reply.
//
// Auth: staff or internal key.
// deno-lint-ignore-file no-explicit-any

import { svc } from "../_shared/chat/kb.ts";
import { normKey } from "../_shared/chat/engine.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;
  if (req.method !== "POST") return json(cors, 405, { ok: false, error: "use POST" });

  try {
    const b = await req.json().catch(() => ({}));
    const db = svc();

    // learned-reply management
    if (b.toggleLearnedId) {
      const { error } = await db.from("learned_reply").update({ active: b.active !== false }).eq("id", b.toggleLearnedId);
      if (error) throw error;
      return json(cors, 200, { ok: true, toggled: b.toggleLearnedId, active: b.active !== false });
    }

    // Outbox: approve a bot-proposed reply (human pasted it into EasySocial).
    if (b.approveReplyLogId) {
      const patch: any = { status: "sent_manual" };
      if (typeof b.message === "string" && b.message.trim()) patch.outbound_text = b.message.trim();
      const { error } = await db.from("reply_log").update(patch).eq("id", b.approveReplyLogId);
      if (error) throw error;
      return json(cors, 200, { ok: true, approved: b.approveReplyLogId });
    }

    // Outbox: discard a bot-proposed reply.
    if (b.discardReplyLogId) {
      const { error } = await db.from("reply_log").update({ status: "discarded" }).eq("id", b.discardReplyLogId);
      if (error) throw error;
      return json(cors, 200, { ok: true, discarded: b.discardReplyLogId });
    }

    const { leadId, phone, inbound_text, message, escalationId } = b;
    const learn = b.learn !== false;
    if (!leadId || !message) return json(cors, 400, { ok: false, error: "leadId and message required" });

    // 1) remember it (the brain reuses it exactly + fuzzily for near-identical questions)
    let learned = false;
    if (learn && inbound_text) {
      const key = normKey(inbound_text);
      if (key) {
        const { error } = await db.from("learned_reply").upsert(
          { match_key: key, sample_inbound: inbound_text, message, created_by: b.created_by || "dashboard", active: true },
          { onConflict: "match_key" },
        );
        learned = !error;
      }
    }

    // 2) close the escalation + log the human delivery
    if (escalationId) {
      await db.from("escalation_queue").update({
        status: "handled", handled_at: new Date().toISOString(), handled_by: b.created_by || "dashboard",
      }).eq("id", escalationId);
    }
    await db.from("reply_log").insert({
      lead_id: Number(leadId), phone, inbound_text: inbound_text || null,
      matched_intent: "human_answer", action: "learned", reply_ref: "dashboard",
      outbound_text: message, confidence: 1, status: "sent_manual",
    });

    return json(cors, 200, { ok: true, learned, delivery: "manual" });
  } catch (e) {
    console.error("chat-answer error:", e);
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
