// chat-suggest — OFFLINE reply suggester. NO WhatsApp / EasySocial connection.
//
// The old auto-responder swept EasySocial chats and pushed template messages;
// those automated sends kept getting the dealership's WhatsApp number banned,
// so on 2026-07-10 the owner ordered every EasySocial code path removed. The
// deterministic reply brain survives, repurposed: staff paste a client's
// question here, and this returns the best answer from the KB plus everything
// the team has taught it — the human copies the reply into whatever channel
// THEY choose. This function talks ONLY to the Lumina database.
//
//   POST { question, name? }            → { ok, suggestion|null, alternates[], holding_text? }
//   POST { learn: {question, answer} }  → upsert a learned reply (teach the brain)
//   POST { toggleLearnedId, active }    → enable/disable a learned reply
//   GET  ?view=learned                  → learned answers list
//
// Auth: staff JWT (admin / F&I / senior F&I) or the internal key.
// deno-lint-ignore-file no-explicit-any

import { getKB, svc } from "../_shared/chat/kb.ts";
import { decideSmart, buildSmartKb } from "../_shared/chat/brain.ts";
import { normKey, personalize } from "../_shared/chat/engine.ts";
import { normalizeText, segments } from "../_shared/chat/normalize.ts";
import { matchAll } from "../_shared/chat/matcher.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;

  try {
    const db = svc();
    const url = new URL(req.url);

    // Any method — the panel's invoke() defaults to POST even with query params.
    if (url.searchParams.get("view") === "learned") {
      const { data, error } = await db.from("learned_reply")
        .select("id,match_key,sample_inbound,message,hits,active,created_at,last_used_at")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json(cors, 200, { ok: true, count: (data || []).length, items: data || [] });
    }
    if (req.method !== "POST") return json(cors, 405, { ok: false, error: "use POST" });

    const b = await req.json().catch(() => ({}));

    if (b.toggleLearnedId) {
      const { error } = await db.from("learned_reply").update({ active: b.active !== false }).eq("id", b.toggleLearnedId);
      if (error) throw error;
      return json(cors, 200, { ok: true, toggled: b.toggleLearnedId, active: b.active !== false });
    }

    // Teach: remember a Q→A pair. The brain reuses it exactly AND fuzzily for
    // near-identical questions (same behaviour the escalation queue had).
    if (b.learn && b.learn.question && b.learn.answer) {
      const key = normKey(String(b.learn.question));
      if (!key) return json(cors, 400, { ok: false, error: "question too short to learn" });
      const { error } = await db.from("learned_reply").upsert(
        {
          match_key: key,
          sample_inbound: String(b.learn.question).trim(),
          message: String(b.learn.answer).trim(),
          created_by: b.created_by || "suggester",
          active: true,
        },
        { onConflict: "match_key" },
      );
      if (error) throw error;
      return json(cors, 200, { ok: true, learned: true });
    }

    const question = String(b.question || "").trim();
    if (!question) return json(cors, 400, { ok: false, error: "question required" });
    const name = String(b.name || "").trim();

    const kb = await getKB();
    const smart = buildSmartKb(kb);
    const d = decideSmart({
      text: question,
      state: { name },
      kb,
      smart,
      now: new Date(),
      context: { latestClientText: question },
      leadKey: "suggest:" + normKey(question).slice(0, 40),
    });

    // ---- primary suggestion from the decision ------------------------------
    let suggestion: any = null;
    if ((d.action === "qr" || d.action === "learned") && d.outbound_text) {
      suggestion = { text: d.outbound_text };
    } else if (d.action === "sequence" && Array.isArray((d as any).messages) && (d as any).messages.length) {
      suggestion = { text: (d as any).messages.map((m: string) => personalize(m, { name })).join("\n\n") };
    } else if (d.action === "funnel" && d.outbound_text) {
      const buttons = Array.isArray((d as any).buttons) ? (d as any).buttons : [];
      suggestion = { text: d.outbound_text + (buttons.length ? "\n" + buttons.map((x: string) => `• ${x}`).join("\n") : "") };
    } else if (d.action === "template" && d.reply_ref) {
      const t = (kb.templates || []).find((x: any) => String(x.id) === String(d.reply_ref) || x.name === d.reply_ref);
      if (t && t.body) suggestion = { text: personalize(String(t.body), { name }) };
    }
    if (suggestion) {
      suggestion.source = d.brain || "v1";
      suggestion.reason = d.reason || null;
      suggestion.ref = d.reply_ref || null;
      suggestion.confidence = d.confidence ?? null;
    }

    // ---- alternates: top-scored quick-reply intents for the same question --
    // Offered even when the brain answered, so the human can pick a better fit.
    const segTokens = segments(question).map((s: string) => normalizeText(s, smart.lexicon, smart.vocab).tokens);
    segTokens.push(normalizeText(question, smart.lexicon, smart.vocab).tokens);
    const ranked = matchAll(segTokens, smart.index, 0.4);
    const qrByKeyword = Object.fromEntries((kb.quick_replies || []).map((q: any) => [q.keyword, q.message]));
    const pickedRefs = String(d.reply_ref || "");
    const seen = new Set<string>();
    const alternates: any[] = [];
    for (const r of ranked) {
      const it = smart.index.intents.get(r.intent);
      if (!it || it.active === false || it.action !== "qr") continue;
      const target = String(it.target || "");
      if (!target || seen.has(target) || pickedRefs.includes(target)) continue;
      const body = qrByKeyword[target];
      if (!body) continue;
      seen.add(target);
      alternates.push({ text: personalize(String(body), { name }), ref: target, score: +r.score.toFixed(3) });
      if (alternates.length >= 3) break;
    }

    return json(cors, 200, {
      ok: true,
      suggestion,
      alternates,
      holding_text: suggestion ? null : ((d as any).holding_text || null),
      escalate_reason: suggestion ? null : (d.reason || null),
    });
  } catch (e) {
    console.error("chat-suggest error:", e);
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
