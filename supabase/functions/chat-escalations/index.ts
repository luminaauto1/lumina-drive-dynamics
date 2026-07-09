// chat-escalations — the "needs you" queue + learned-answers list (port of
// lumina-chat/api/escalations.js, extended with ?view=learned for the
// dashboard's Learned Answers panel). Auth: staff or internal.
// deno-lint-ignore-file no-explicit-any

import { svc } from "../_shared/chat/kb.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;

  try {
    const url = new URL(req.url);
    const db = svc();

    if (url.searchParams.get("view") === "learned") {
      const { data, error } = await db.from("learned_reply")
        .select("id,match_key,sample_inbound,message,hits,active,created_at,last_used_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json(cors, 200, { ok: true, count: (data || []).length, items: data || [] });
    }

    const status = url.searchParams.get("status") || "open";
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
    const { data, error } = await db.from("escalation_queue")
      .select("id,lead_id,phone,name,inbound_text,reason,chat_url,status,created_at")
      .eq("status", status).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return json(cors, 200, { ok: true, count: (data || []).length, items: data || [] });
  } catch (e) {
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
