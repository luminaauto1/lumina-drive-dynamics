// chat-answer — "the bot was unsure, a human types the answer" (port of
// lumina-chat/api/answer.js). Sends via EasySocial (dry-run aware), remembers
// the answer as an exact-message learned reply (the brain also recalls it
// fuzzily for near-identical questions), closes the escalation, logs it.
// Also handles learned-reply toggling: POST { toggleLearnedId, active }.
// Auth: staff or internal.
// deno-lint-ignore-file no-explicit-any

import { svc, getChatConfig } from "../_shared/chat/kb.ts";
import * as es from "../_shared/chat/easysocial.ts";
import { normKey } from "../_shared/chat/engine.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
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

    const { leadId, phone, inbound_text, message, escalationId } = b;
    const learn = b.learn !== false;
    if (!leadId || !message) return json(cors, 400, { ok: false, error: "leadId and message required" });

    const cfg = await getChatConfig();

    // 1) send through EasySocial (dry-run aware)
    const sendResult = await es.sendMessage(cfg, leadId, message);
    const sent = !(sendResult && sendResult.dryRun);

    // 2) remember it
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

    // 3) close the escalation + log
    if (escalationId) {
      await db.from("escalation_queue").update({
        status: "handled", handled_at: new Date().toISOString(), handled_by: b.created_by || "dashboard",
      }).eq("id", escalationId);
    }
    await db.from("reply_log").insert({
      lead_id: Number(leadId), phone, inbound_text: inbound_text || null,
      matched_intent: "human_answer", action: "learned", reply_ref: "dashboard",
      outbound_text: message, confidence: 1, status: sent ? "sent" : "dry_run",
    });

    return json(cors, 200, { ok: true, sent, learned, dryRun: !sent });
  } catch (e) {
    console.error("chat-answer error:", e);
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
