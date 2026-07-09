// chat-escalations â€” the "needs you" queue + learned-answers list (port of
// lumina-chat/api/escalations.js, extended with ?view=learned for the
// dashboard's Learned Answers panel). Auth: staff or internal.
// deno-lint-ignore-file no-explicit-any

import { svc } from "../_shared/chat/kb.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
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

    // Outbox: bot-proposed replies awaiting human approval + paste-delivery.
    // These are the dry_run reply_log rows from the batch sweep (answerable
    // actions only — escalations have their own queue). 48h window so stale
    // proposals never resurface after the conversation has moved on.
    if (url.searchParams.get("view") === "outbox") {
      const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const { data, error } = await db.from("reply_log")
        .select("id,lead_id,phone,inbound_text,outbound_text,action,reply_ref,created_at")
        .eq("status", "dry_run")
        .in("action", ["qr", "learned", "sequence", "funnel"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data || [];
      // Resolve customer names from the CRM by phone (best-effort).
      const phones = [...new Set(rows.map((r: any) => r.phone).filter(Boolean))];
      const names: Record<string, string> = {};
      if (phones.length) {
        const { data: leads } = await db.from("leads")
          .select("phone_number,client_name").in("phone_number", phones);
        for (const l of leads || []) if (l.phone_number) names[l.phone_number] = l.client_name || "";
      }
      const items = rows.map((r: any) => ({
        ...r,
        name: names[r.phone] || "",
        chat_url: `https://app.easysocial.io/engage/chat?tab=all&selectedLead=${r.lead_id}`,
      }));
      return json(cors, 200, { ok: true, count: items.length, items });
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
